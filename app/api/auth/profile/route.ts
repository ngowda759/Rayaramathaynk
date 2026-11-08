import { NextRequest, NextResponse } from "next/server";
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { NEW_PROFILE_ACCESS_FIELDS } from "@/lib/auth/sign-in-profile";
import { z } from "zod";

const profileSyncSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  name: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  profileImage: z.string().url().max(1000).optional().or(z.literal("")),
});

export async function GET(request: NextRequest) {
  try {
    // Check revocation as this is an identity profile read where status matters
    const caller = await verifyBearerIdToken(request, { checkRevoked: true });
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("firestore_id", caller.uid)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ profile: null }, { status: 200 });
    }

    // Map the Supabase row back to the expected UserProfile structure.
    // The previous implementation stored isApproved and emailVerified in Firestore,
    // but the actual identity source of truth is Firebase Auth.
    // We map them dynamically or safely fallback.
    const profile = {
      uid: data.firestore_id,
      name: data.display_name || "",
      email: data.email,
      phone: data.phone_number || "",
      role: data.role || "devotee",
      templeId: "main",
      profileImage: data.photo_url || "",
      // isApproved is mostly unused (F-11 audit noted it), we derive it from active
      isApproved: data.active === true, 
      isActive: data.active === true,
      // We know they successfully authenticated with Firebase to reach this endpoint with a valid token
      emailVerified: true, 
      lastLogin: null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/auth/profile] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await verifyBearerIdToken(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payloadRaw = await request.json();
    const parseResult = profileSyncSchema.safeParse(payloadRaw);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Bad Request", details: parseResult.error.format() }, { status: 400 });
    }
    const payload = parseResult.data;

    const supabase = createAdminClient();

    // Check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("firestore_id", caller.uid)
      .maybeSingle();
      
    if (checkError) throw checkError;

    const write: Record<string, unknown> = {
      email: payload.email || caller.email || "",
      display_name: payload.name || "",
      phone_number: payload.phone || "",
      photo_url: payload.profileImage || "",
    };

    if (existingUser) {
      // Update existing profile. Note: we do NOT update role or active status from client payload.
      const { error } = await supabase
        .from("users")
        .update(write)
        .eq("firestore_id", caller.uid);

      if (error) throw error;
    } else {
      // Create new profile. Only a new profile gets the default access fields from the client.
      write.firestore_id = caller.uid;
      write.role = NEW_PROFILE_ACCESS_FIELDS.role;
      write.active = NEW_PROFILE_ACCESS_FIELDS.isActive;
      
      const { error } = await supabase
        .from("users")
        .insert(write);

      if (error) throw error;
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/auth/profile] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
