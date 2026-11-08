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
        // Authenticated request: caller UID must match the payload userId
        if (caller.uid !== userId) {
          return NextResponse.json(
            { error: "User identity does not match authenticated session" },
            { status: 403 }
          );
        }
      } else {
        // Unauthenticated request (e.g. freshly signed up, email verification pending):
        // Verify that the userId exists in Supabase Auth Admin and email matches
        const adminAuth = (supabase.auth as unknown as {
          admin?: {
            getUserById?: (id: string) => Promise<{
              data?: { user?: { id: string; email?: string } | null };
              error?: unknown;
            }>;
          };
        })?.admin;

        if (typeof adminAuth?.getUserById === "function") {
          const { data: authUserResult, error: authUserError } =
            await adminAuth.getUserById(userId);

          if (authUserError || !authUserResult?.user?.id) {
            return NextResponse.json(
              { error: "User identity does not exist in authentication provider" },
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
      }

      // 2. Check if user profile already exists
      const { data: existing, error: existingError } = await supabase
        .from("users")
        .select("id, role, auth_user_id, email")
        .or(`auth_user_id.eq.${userId},email.eq.${email}`)
        .maybeSingle();

      if (existing) {
        // Link auth_user_id if missing on existing email record
        if (!existing.auth_user_id && existing.email?.toLowerCase() === email) {
          await supabase
            .from("users")
            .update({ auth_user_id: userId, display_name: name })
            .eq("id", existing.id);
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
        // Handle concurrent registration race (Postgres unique constraint violation code 23505)
        const isConflict =
          (insertError as { code?: string })?.code === "23505" ||
          /duplicate key|already exists/i.test(insertError.message || "");

        if (isConflict) {
          return NextResponse.json({ success: true, message: "User already provisioned" });
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
