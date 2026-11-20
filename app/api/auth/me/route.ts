import { NextRequest, NextResponse } from "next/server";
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EMAIL_CONFLICT_MESSAGE,
  findEmailConflicts,
  findOwnedRowAfterConflict,
  isUniqueViolation,
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
    const { data: userRow, error: queryError } = await supabase
      .from("users")
      .select(PROFILE_COLUMNS)
      .eq("auth_user_id", callerUid)
      .maybeSingle();

    if (queryError) {
      console.error("[api/auth/me] DB query error:", queryError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (userRow) {
      return NextResponse.json(mapRowToProfile(userRow as Record<string, unknown>, callerEmail));
    }

    // A row that already carries this address but is not linked to this identity must never be
    // adopted or duplicated: adopting it would be an email-based link, and duplicating it would
    // strand the person's existing role and history. Reconciliation is an administrative act.
    const conflictCheck = await findEmailConflicts(supabase, callerEmail, callerUid);
    if (!conflictCheck.ok) {
      console.error("[api/auth/me] Email conflict check failed");
      return NextResponse.json({ error: "Failed to load user profile" }, { status: 500 });
    }
    if (conflictCheck.conflicts.length > 0) {
      return NextResponse.json({ error: EMAIL_CONFLICT_MESSAGE }, { status: 409 });
    }

    // Idempotent devotee self-provisioning for a verified identity with no existing row.
    const insertPayload: Record<string, unknown> = {
      email: callerEmail || "",
      role: "devotee",
      active: true,
      display_name: callerEmail ? callerEmail.split("@")[0] : "Devotee",
      auth_user_id: callerUid,
    };

    const { data: created, error: insertError } = await supabase
      .from("users")
      .insert(insertPayload)
      .select(PROFILE_COLUMNS)
      .single();

    if (insertError || !created) {
      // Concurrent insert race (Postgres 23505): only a row that is demonstrably this caller's
      // may be returned. Anything else fails closed rather than being adopted.
      if (isUniqueViolation(insertError)) {
        const recheck = await findOwnedRowAfterConflict<ProfileRow>(supabase, callerUid, PROFILE_COLUMNS);

        if (!recheck.ok) {
          console.error("[api/auth/me] Race recovery lookup failed");
          return NextResponse.json({ error: "Failed to load user profile" }, { status: 500 });
        }
        if (recheck.row) {
          return NextResponse.json(mapRowToProfile(recheck.row, callerEmail));
        }

        return NextResponse.json({ error: EMAIL_CONFLICT_MESSAGE }, { status: 409 });
      }

      console.error("[api/auth/me] Failed to self-provision devotee:", insertError);
      return NextResponse.json({ error: "Failed to load user profile" }, { status: 500 });
    }

    return NextResponse.json(mapRowToProfile(created as Record<string, unknown>, callerEmail));
  } catch (error) {
    console.error("[api/auth/me] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
