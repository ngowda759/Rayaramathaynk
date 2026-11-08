import { NextRequest, NextResponse } from "next/server";
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/supabase/identifier";
import type { UserProfile } from "@/types/user";

function mapRowToProfile(
  row: Record<string, unknown>,
  callerEmail: string | null
): UserProfile {
  return {
    uid: String(row.auth_user_id || row.firestore_id || row.id),
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
    const filterQuery = isUuid(callerUid)
      ? `auth_user_id.eq.${callerUid},id.eq.${callerUid}`
      : `firestore_id.eq.${callerUid}`;

    const { data: userRow, error: queryError } = await supabase
      .from("users")
      .select("id, auth_user_id, firestore_id, email, display_name, phone_number, role, active, created_at, updated_at")
      .or(filterQuery)
      .maybeSingle();

    if (queryError) {
      console.error("[api/auth/me] DB query error:", queryError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (userRow) {
      return NextResponse.json(mapRowToProfile(userRow as Record<string, unknown>, callerEmail));
    }

    // Idempotent devotee self-provisioning for valid authenticated user
    const insertPayload: Record<string, unknown> = {
      email: callerEmail || "",
      role: "devotee",
      active: true,
      display_name: callerEmail ? callerEmail.split("@")[0] : "Devotee",
    };

    if (isUuid(callerUid)) {
      insertPayload.auth_user_id = callerUid;
    } else {
      insertPayload.firestore_id = callerUid;
    }

    const { data: created, error: insertError } = await supabase
      .from("users")
      .insert(insertPayload)
      .select("id, auth_user_id, firestore_id, email, display_name, phone_number, role, active, created_at, updated_at")
      .single();

    if (insertError || !created) {
      // Handle concurrent insert race condition (Postgres error 23505)
      const isConflict =
        (insertError as { code?: string })?.code === "23505" ||
        /duplicate key|already exists/i.test(insertError?.message || "");

      if (isConflict) {
        const { data: recheck } = await supabase
          .from("users")
          .select("id, auth_user_id, firestore_id, email, display_name, phone_number, role, active, created_at, updated_at")
          .or(filterQuery)
          .maybeSingle();

        if (recheck) {
          return NextResponse.json(mapRowToProfile(recheck as Record<string, unknown>, callerEmail));
        }
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
