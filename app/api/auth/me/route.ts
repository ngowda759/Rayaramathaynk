import { NextRequest, NextResponse } from "next/server";
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/supabase/identifier";
import type { UserProfile } from "@/types/user";

export async function GET(request: NextRequest) {
  try {
    const caller = await verifyBearerIdToken(request);
    let callerUid = caller?.uid ?? null;
    let callerEmail = caller?.email ?? null;

    // If no bearer token, check Supabase cookie session
    if (!callerUid) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabaseServer = await createClient();
      const { data: userData } = await supabaseServer.auth.getUser();
      if (userData?.user) {
        callerUid = userData.user.id;
        callerEmail = userData.user.email ?? null;
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
      const profile: UserProfile = {
        uid: String(userRow.auth_user_id || userRow.firestore_id || userRow.id),
        name: String(userRow.display_name || userRow.email || "").split("@")[0],
        email: String(userRow.email || callerEmail || ""),
        phone: userRow.phone_number ? String(userRow.phone_number) : "",
        role: (userRow.role as any) || "devotee",
        templeId: "main",
        profileImage: "",
        isApproved: false,
        isActive: userRow.active !== false,
        emailVerified: false,
        lastLogin: null,
        createdAt: userRow.created_at as any,
        updatedAt: userRow.updated_at as any,
      };
      return NextResponse.json(profile);
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
      console.error("[api/auth/me] Failed to self-provision devotee:", insertError);
      return NextResponse.json({ error: "Failed to load user profile" }, { status: 500 });
    }

    const newProfile: UserProfile = {
      uid: String(created.auth_user_id || created.firestore_id || created.id),
      name: String(created.display_name || created.email || "").split("@")[0],
      email: String(created.email || ""),
      phone: created.phone_number ? String(created.phone_number) : "",
      role: (created.role as any) || "devotee",
      templeId: "main",
      profileImage: "",
      isApproved: false,
      isActive: created.active !== false,
      emailVerified: false,
      lastLogin: null,
      createdAt: created.created_at as any,
      updatedAt: created.updated_at as any,
    };

    return NextResponse.json(newProfile);
  } catch (error) {
    console.error("[api/auth/me] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
