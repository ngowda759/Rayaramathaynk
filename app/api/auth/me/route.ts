import { NextRequest, NextResponse } from "next/server";
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_CONFLICT_MESSAGE, provisionDevoteeRow } from "@/lib/auth/provisioning";
import type { UserProfile } from "@/types/user";

const PROFILE_COLUMNS =
  "id, auth_user_id, email, display_name, phone_number, role, active, created_at, updated_at";

type ProfileRow = Record<string, unknown> & { auth_user_id: string | null };

function mapRowToProfile(
  row: Record<string, unknown>,
  callerEmail: string | null
): UserProfile {
  return {
    uid: String(row.auth_user_id || row.id),
    name: String(row.display_name || row.email || "").split("@")[0] || "Devotee",
    email: String(row.email || callerEmail || ""),
    phone: row.phone_number ? String(row.phone_number) : "",
    role: (row.role as any) || "devotee",
    templeId: "main",
    profileImage: "",
    isApproved: false,
    isActive: row.active !== false,
    emailVerified: false,
    lastLogin: null,
    createdAt: row.created_at as any,
    updatedAt: row.updated_at as any,
  };
}

export async function GET(request: NextRequest) {
  try {
    const caller = await verifyBearerIdToken(request);
    let callerUid = caller?.uid ?? null;
    let callerEmail = caller?.email ?? null;

    // If no bearer token, check Supabase cookie session
    if (!callerUid) {
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const supabaseServer = await createClient();
        const { data: userData } = await supabaseServer.auth.getUser();
        if (userData?.user) {
          callerUid = userData.user.id;
          callerEmail = userData.user.email ?? null;
        }
      } catch {
        // Cookie context unavailable or no session
      }
    }

    if (!callerUid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    // Supabase Auth is the only sign-in provider, so `callerUid` is always a Supabase Auth UUID. The
    // authorization row is matched on `auth_user_id` only: a row whose `id` happens to equal the Auth
    // UID has never been linked, and treating it as the caller's would be an implicit link.
    // The rules live in lib/auth/provisioning.ts so the OAuth callback cannot drift from this route.
    const outcome = await provisionDevoteeRow<ProfileRow>(supabase, {
      uid: callerUid,
      email: callerEmail,
      displayName: callerEmail ? callerEmail.split("@")[0] : "Devotee",
      columns: PROFILE_COLUMNS,
    });

    switch (outcome.status) {
      case "linked":
      case "created":
        return NextResponse.json(mapRowToProfile(outcome.row as Record<string, unknown>, callerEmail));
      case "conflict":
        // A row already carries this address but is not linked to this identity. Adopting it would be
        // an email-based link; duplicating it would strand the person's existing role and history.
        return NextResponse.json({ error: EMAIL_CONFLICT_MESSAGE }, { status: 409 });
      default:
        console.error("[api/auth/me] Provisioning failed");
        return NextResponse.json({ error: "Failed to load user profile" }, { status: 500 });
    }
  } catch (error) {
    console.error("[api/auth/me] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
