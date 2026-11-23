import { NextRequest, NextResponse } from "next/server";
import { resolveVerifiedCaller } from "@/lib/auth/verify-id-token";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EMAIL_CONFLICT_MESSAGE,
  EMAIL_NOT_VERIFIED_MESSAGE,
  isConfirmedEmail,
  provisionDevoteeRow,
} from "@/lib/auth/provisioning";
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
    // This route only reaches a profile after the confirmed-email gate above.
    emailVerified: true,
    lastLogin: null,
    createdAt: row.created_at as any,
    updatedAt: row.updated_at as any,
  };
}

export async function GET(request: NextRequest) {
  try {
    const resolution = await resolveVerifiedCaller(request);
    if (resolution.status === "unavailable") {
      return NextResponse.json({ error: "Authentication provider error" }, { status: 503 });
    }
    if (resolution.status !== "ok") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const caller = resolution.caller;
    // Provisioning depends on the identity, so a confirmed address is required before any read.
    if (!caller.email || !isConfirmedEmail(caller.emailConfirmedAt)) {
      return NextResponse.json({ error: EMAIL_NOT_VERIFIED_MESSAGE }, { status: 403 });
    }

    const supabase = createAdminClient();
    // Supabase Auth is the only sign-in provider, so `caller.uid` is always a Supabase Auth UUID. The
    // authorization row is matched on `auth_user_id` only: a row whose `id` happens to equal the Auth
    // UID has never been linked, and treating it as the caller's would be an implicit link.
    // The rules live in lib/auth/provisioning.ts so the OAuth callback cannot drift from this route.
    const outcome = await provisionDevoteeRow<ProfileRow>(supabase, {
      uid: caller.uid,
      email: caller.email,
      emailConfirmedAt: caller.emailConfirmedAt,
      displayName: caller.email.split("@")[0] || "Devotee",
      columns: PROFILE_COLUMNS,
    });

    switch (outcome.status) {
      case "linked":
      case "created":
        return NextResponse.json(mapRowToProfile(outcome.row as Record<string, unknown>, caller.email));
      case "conflict":
        // A row already carries this address but is not linked to this identity. Adopting it would be
        // an email-based link; duplicating it would strand the person's existing role and history.
        return NextResponse.json({ error: EMAIL_CONFLICT_MESSAGE }, { status: 409 });
      case "unverified":
        return NextResponse.json({ error: EMAIL_NOT_VERIFIED_MESSAGE }, { status: 403 });
      default:
        console.error("[api/auth/me] Provisioning failed");
        return NextResponse.json({ error: "Failed to load user profile" }, { status: 500 });
    }
  } catch (error) {
    console.error("[api/auth/me] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
