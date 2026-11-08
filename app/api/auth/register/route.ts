import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/supabase/identifier";
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";

const registerBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().pipe(z.email("Invalid email format")),
  phone: z.string().optional().default(""),
  userId: z.string().optional(),
});

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

      // 1. Authoritative identity verification
      const caller = await verifyBearerIdToken(request);
      if (caller) {
        // Authenticated request: caller UID and email must match the requested payload
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
      } else {
        // Unauthenticated registration (e.g. freshly signed up, session not yet active):
        // FAIL CLOSED: Require a functioning Supabase Auth Admin lookup. Never assume identity on provider failure.
        const adminAuth = (supabase.auth as unknown as {
          admin?: {
            getUserById?: (id: string) => Promise<{
              data?: { user?: { id: string; email?: string } | null };
              error?: unknown;
            }>;
          };
        })?.admin;

        if (!adminAuth || typeof adminAuth.getUserById !== "function") {
          console.error("[api/auth/register] Supabase Auth Admin getUserById is unavailable");
          return NextResponse.json(
            { error: "Authentication admin lookup service is unavailable" },
            { status: 500 }
          );
        }

        const { data: authUserResult, error: authUserError } =
          await adminAuth.getUserById(userId);

        if (authUserError || !authUserResult?.user?.id) {
          return NextResponse.json(
            { error: "User identity does not exist in authentication provider" },
            { status: 400 }
          );
        }

        if (authUserResult.user.id !== userId) {
          return NextResponse.json(
            { error: "User identity mismatch in authentication provider" },
            { status: 400 }
          );
        }

        const registeredEmail = authUserResult.user.email?.trim().toLowerCase();
        if (registeredEmail && registeredEmail !== email) {
          return NextResponse.json(
            { error: "Email does not match registered authentication account" },
            { status: 400 }
          );
        }
      }

      // 2. Query existing profiles and reject ambiguous matches
      const { data: existingList, error: queryError } = await supabase
        .from("users")
        .select("id, role, auth_user_id, email")
        .or(`auth_user_id.eq.${userId},email.eq.${email}`);

      if (queryError) {
        console.error("[api/auth/register] DB lookup error:", queryError);
        return NextResponse.json({ error: "Database lookup failed" }, { status: 500 });
      }

      if (Array.isArray(existingList) && existingList.length > 1) {
        // Ambiguous match: one record has the email, another has the auth_user_id
        return NextResponse.json(
          { error: "Ambiguous user profile conflict" },
          { status: 409 }
        );
      }

      const existing = Array.isArray(existingList) ? existingList[0] : null;

      if (existing) {
        // If profile already belongs to another auth_user_id
        if (existing.auth_user_id && existing.auth_user_id !== userId) {
          return NextResponse.json(
            { error: "Account with this email already belongs to a different identity" },
            { status: 409 }
          );
        }

        // If email matches but auth_user_id was unpopulated (legacy record), link it
        if (!existing.auth_user_id && existing.email?.toLowerCase() === email) {
          const { error: updateError } = await supabase
            .from("users")
            .update({ auth_user_id: userId, display_name: name })
            .eq("id", existing.id);

          if (updateError) {
            console.error("[api/auth/register] Failed to link auth_user_id:", updateError);
            return NextResponse.json({ error: "Failed to update user profile" }, { status: 500 });
          }
        }

        return NextResponse.json({ success: true, message: "User already provisioned" });
      }

      // 3. Provision default devotee user (Fail-closed role assignment)
      const { error: insertError } = await supabase.from("users").insert({
        auth_user_id: userId,
        email,
        display_name: name,
        phone_number: phone || null,
        role: "devotee",
        active: true,
      });

      if (insertError) {
        // Handle concurrent registration race (PostgreSQL unique constraint violation code 23505)
        const isConflict =
          (insertError as { code?: string })?.code === "23505" ||
          /duplicate key|already exists/i.test(insertError.message || "");

        if (isConflict) {
          // Re-query and verify exact identity mapping before returning success
          const { data: recheck, error: recheckError } = await supabase
            .from("users")
            .select("id, role, auth_user_id, email")
            .or(`auth_user_id.eq.${userId},email.eq.${email}`)
            .maybeSingle();

          if (recheckError) {
            return NextResponse.json({ error: "Database error during race resolution" }, { status: 500 });
          }

          if (
            recheck &&
            recheck.auth_user_id === userId &&
            recheck.email?.toLowerCase() === email
          ) {
            return NextResponse.json({ success: true, message: "User already provisioned" });
          }

          return NextResponse.json(
            { error: "Conflict: user profile already exists with different credentials" },
            { status: 409 }
          );
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
