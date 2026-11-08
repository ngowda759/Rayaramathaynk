import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/supabase/identifier";
import type { UserProfile } from "@/types/user";

// Strict schema: reject any client trying to set privileged fields
const profileSyncSchema = z
  .object({
    email: z.string().email().optional().or(z.literal("")),
    name: z.string().max(200).optional().or(z.literal("")),
    phone: z.string().max(50).optional().or(z.literal("")),
    profileImage: z.string().url().max(1000).optional().or(z.literal("")),
  })
  .strict();

async function getCallerIdentity(request: NextRequest): Promise<{
  uid: string;
  email: string | null;
  emailVerified: boolean;
} | null> {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  // 1. Supabase Auth
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    if (typeof supabase?.auth?.getUser === "function") {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        const emailVerified = Boolean(
          data.user.email_confirmed_at || (data.user as { confirmed_at?: string }).confirmed_at
        );
        return {
          uid: data.user.id,
          email: typeof data.user.email === "string" ? data.user.email : null,
          emailVerified,
        };
      }
    }
  } catch {
    // proceed to Firebase
  }

  // 2. Firebase Admin Auth
  try {
    const { getAdminApp } = await import("@/lib/admin-firebase");
    const app = await getAdminApp();
    const { getAuth } = await import("firebase-admin/auth");
    const auth = getAuth(app);
    const decoded = await auth.verifyIdToken(token, true);
    return {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : null,
      emailVerified: decoded.email_verified === true,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const caller = await getCallerIdentity(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const filterQuery = isUuid(caller.uid)
      ? `auth_user_id.eq.${caller.uid},id.eq.${caller.uid}`
      : `firestore_id.eq.${caller.uid}`;

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .or(filterQuery)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/auth/profile] Supabase error:", error.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ profile: null }, { status: 200 });
    }

    const profile: UserProfile = {
      uid: String(data.auth_user_id || data.firestore_id || data.id),
      name: data.display_name || (data.email ? data.email.split("@")[0] : "Devotee"),
      email: data.email || caller.email || "",
      phone: data.phone_number || "",
      role: (data.role as any) || "devotee",
      templeId: "main",
      profileImage: data.photo_url || "",
      isApproved: false,
      isActive: data.active !== false,
      emailVerified: caller.emailVerified,
      lastLogin: null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/auth/profile] Unexpected error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerIdentity(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payloadRaw = await request.json().catch(() => null);
    if (!payloadRaw || typeof payloadRaw !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = profileSyncSchema.safeParse(payloadRaw);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Bad Request: client-controlled changes to privileged fields are forbidden", details: parseResult.error.format() },
        { status: 400 }
      );
    }
    const payload = parseResult.data;

    const supabase = createAdminClient();
    const filterQuery = isUuid(caller.uid)
      ? `auth_user_id.eq.${caller.uid},id.eq.${caller.uid}`
      : `firestore_id.eq.${caller.uid}`;

    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id, role, active")
      .or(filterQuery)
      .maybeSingle();

    if (checkError) {
      console.error("[POST /api/auth/profile] User check error:", checkError.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const updateFields: Record<string, unknown> = {
      email: payload.email || caller.email || "",
      display_name: payload.name || "",
      phone_number: payload.phone || "",
      photo_url: payload.profileImage || "",
      updated_at: new Date().toISOString(),
    };

    if (existingUser) {
      // Preserve existing role and active status - never allow client to change them
      const { error: updateError } = await supabase
        .from("users")
        .update(updateFields)
        .eq("id", existingUser.id);

      if (updateError) {
        console.error("[POST /api/auth/profile] Profile update error:", updateError.message);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
    } else {
      // New profile creation: default to devotee role, active: true
      const insertData: Record<string, unknown> = {
        ...updateFields,
        role: "devotee",
        active: true,
        created_at: new Date().toISOString(),
      };

      if (isUuid(caller.uid)) {
        insertData.auth_user_id = caller.uid;
      } else {
        insertData.firestore_id = caller.uid;
      }

      const { error: insertError } = await supabase
        .from("users")
        .insert(insertData);

      if (insertError) {
        console.error("[POST /api/auth/profile] Profile creation error:", insertError.message);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/auth/profile] Unexpected error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
