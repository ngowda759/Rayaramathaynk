/**
 * Self-provisioning for a newly registered devotee.
 *
 * Security contract (docs/auth/PHASE-2-IDENTITY-UNIFICATION.md §3):
 * - A matching email address never authorises identity linking, verified or not.
 * - This route can only CREATE a devotee row. It never binds a pre-existing row
 *   to the caller; unlinked rows are reconciled by an administrative process.
 * - Verification status comes from `auth.admin.getUserById` only — never from a
 *   token claim, session or client-supplied field.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/supabase/identifier";
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { EMAIL_CONFLICT_MESSAGE, emailEqualsFilter, isUniqueViolation } from "@/lib/auth/provisioning";

const registerBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().pipe(z.email("Invalid email format")),
  phone: z.string().optional().default(""),
  userId: z.string().optional(),
});

/** The subset of the Supabase Auth record this route relies on. */
interface AuthIdentity {
  id: string;
  email: string | null;
  /** Non-null only when Supabase has confirmed the address. */
  emailConfirmedAt: string | null;
}

type IdentityLookup =
  | { ok: true; identity: AuthIdentity }
  | { ok: false; status: number; error: string };

/**
 * Read the authoritative Supabase Auth record for `userId`.
 *
 * Fails closed on every uncertainty: a missing admin API, a thrown error, or a
 * record that does not match `userId` is never treated as a usable identity.
 */
async function lookupIdentity(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<IdentityLookup> {
  const adminAuth = (supabase.auth as unknown as {
    admin?: {
      getUserById?: (id: string) => Promise<{
        data?: {
          user?: {
            id?: string;
            email?: string | null;
            email_confirmed_at?: string | null;
            confirmed_at?: string | null;
          } | null;
        };
        error?: unknown;
      }>;
    };
  })?.admin;

  if (!adminAuth || typeof adminAuth.getUserById !== "function") {
    console.error("[api/auth/register] Supabase Auth Admin getUserById is unavailable");
    return { ok: false, status: 500, error: "Authentication admin lookup service is unavailable" };
  }

  let result: Awaited<ReturnType<NonNullable<typeof adminAuth.getUserById>>>;
  try {
    result = await adminAuth.getUserById(userId);
  } catch (error) {
    console.error(
      "[api/auth/register] Supabase Auth lookup failed:",
      error instanceof Error ? error.message : error
    );
    return { ok: false, status: 500, error: "Authentication admin lookup service is unavailable" };
  }

  const { data, error } = result ?? {};
  if (error || !data?.user?.id) {
    return { ok: false, status: 400, error: "User identity does not exist in authentication provider" };
  }
  if (data.user.id !== userId) {
    return { ok: false, status: 400, error: "User identity mismatch in authentication provider" };
  }

  const confirmed = data.user.email_confirmed_at ?? data.user.confirmed_at ?? null;
  return {
    ok: true,
    identity: {
      id: data.user.id,
      email: typeof data.user.email === "string" ? data.user.email : null,
      emailConfirmedAt:
        typeof confirmed === "string" && confirmed.trim().length > 0 ? confirmed : null,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => null);
    if (!raw) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = registerBodySchema.safeParse(raw);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const { name, email, phone, userId } = parseResult.data;
    const supabase = createAdminClient();

    if (userId) {
      if (!isUuid(userId)) {
        return NextResponse.json({ error: "Invalid user identifier" }, { status: 400 });
      }

      // 1. If a bearer token is supplied it must describe the same identity.
      const caller = await verifyBearerIdToken(request);
      if (caller) {
        if (caller.uid !== userId) {
          return NextResponse.json(
            { error: "User identity does not match authenticated session" },
            { status: 403 }
          );
        }
        if (caller.email && caller.email.trim().toLowerCase() !== email) {
          return NextResponse.json(
            { error: "Email does not match authenticated session token" },
            { status: 400 }
          );
        }
      }

      // 2. Resolve the authoritative identity record. This is the only source of
      //    truth for the address and its verification state.
      const lookup = await lookupIdentity(supabase, userId);
      if (!lookup.ok) {
        return NextResponse.json({ error: lookup.error }, { status: lookup.status });
      }
      const identity = lookup.identity;

      if (identity.email && identity.email.trim().toLowerCase() !== email) {
        return NextResponse.json(
          { error: "Email does not match registered authentication account" },
          { status: 400 }
        );
      }

      // 3. A verified address is required before a row is created. Checked before
      //    any database read so an unverified caller cannot probe which addresses
      //    already have a profile.
      if (!identity.emailConfirmedAt) {
        return NextResponse.json(
          { error: "Email verification is required before this account can be provisioned" },
          { status: 403 }
        );
      }

      // 4. Query existing profiles and reject ambiguous matches.
      const { data: existingList, error: queryError } = await supabase
        .from("users")
        .select("id, role, auth_user_id, email")
        .or(`auth_user_id.eq.${userId},${emailEqualsFilter(email)}`);

      if (queryError) {
        console.error("[api/auth/register] DB lookup error:", queryError);
        return NextResponse.json({ error: "Database lookup failed" }, { status: 500 });
      }

      if (Array.isArray(existingList) && existingList.length > 1) {
        // One record carries the email, another carries the auth_user_id.
        return NextResponse.json(
          { error: "Ambiguous user profile conflict" },
          { status: 409 }
        );
      }

      const existing = Array.isArray(existingList) ? existingList[0] : null;

      if (existing) {
        if (existing.auth_user_id === userId) {
          // Already provisioned for this exact identity — idempotent success.
          return NextResponse.json({ success: true, message: "User already provisioned" });
        }

        if (existing.auth_user_id) {
          return NextResponse.json(
            { error: "Account with this email already belongs to a different identity" },
            { status: 409 }
          );
        }

        // Unlinked row. Never claimed here, even though the email is verified:
        // the row may carry a privileged role, and binding it would be an
        // automatic email-based link. The message is deliberately neutral.
        return NextResponse.json({ error: EMAIL_CONFLICT_MESSAGE }, { status: 409 });
      }

      // 5. Provision a default devotee row. The role is fixed server-side.
      const { error: insertError } = await supabase.from("users").insert({
        auth_user_id: userId,
        email,
        display_name: name,
        phone_number: phone || null,
        role: "devotee",
        active: true,
      });

      if (insertError) {
        // Concurrent registration race (PostgreSQL unique violation 23505).
        if (isUniqueViolation(insertError)) {
          const { data: recheck, error: recheckError } = await supabase
            .from("users")
            .select("id, role, auth_user_id, email")
            .or(`auth_user_id.eq.${userId},${emailEqualsFilter(email)}`)
            .maybeSingle();

          if (recheckError) {
            return NextResponse.json({ error: "Database error during race resolution" }, { status: 500 });
          }

          // Only the caller's own row counts as success. An unlinked or foreign
          // row re-observed here is a conflict, never something to adopt.
          if (recheck && recheck.auth_user_id === userId && recheck.email?.toLowerCase() === email) {
            return NextResponse.json({ success: true, message: "User already provisioned" });
          }

          return NextResponse.json({ error: EMAIL_CONFLICT_MESSAGE }, { status: 409 });
        }

        console.error("[api/auth/register] Insert error:", insertError);
        return NextResponse.json({ error: "Failed to provision user profile" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: "User registered successfully" });
  } catch (error) {
    console.error("[api/auth/register] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
