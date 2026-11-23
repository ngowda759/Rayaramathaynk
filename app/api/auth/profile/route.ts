import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveVerifiedCaller } from "@/lib/auth/verify-id-token";
import {
  EMAIL_CONFLICT_MESSAGE,
  EMAIL_NOT_VERIFIED_MESSAGE,
  findEmailConflicts,
  findOwnedRowAfterConflict,
  isConfirmedEmail,
  isUniqueViolation,
} from "@/lib/auth/provisioning";
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
    // The profile row is identity-owned, so a confirmed address is required before any read.
    if (!caller.email || !isConfirmedEmail(caller.emailConfirmedAt)) {
      return NextResponse.json({ error: EMAIL_NOT_VERIFIED_MESSAGE }, { status: 403 });
    }

    const supabase = createAdminClient();
    // Supabase Auth is the only sign-in provider, so `caller.uid` is always a Supabase Auth UUID.
    // The row is matched on `auth_user_id` only: `id` is an independent random uuid and a row whose
    // `id` equals the Auth UID was never linked, so matching it would return a profile the caller
    // does not own.
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", caller.uid)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/auth/profile] Supabase error:", error.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ profile: null }, { status: 200 });
    }

    // Read canonical approval field from Supabase users record
    const isApproved = Boolean((data as Record<string, unknown>).is_approved);

    const profile: UserProfile = {
      uid: String(data.auth_user_id || data.id),
      name: data.display_name || (data.email ? data.email.split("@")[0] : "Devotee"),
      email: data.email || caller.email || "",
      phone: data.phone_number || "",
      role: (data.role as any) || "devotee",
      templeId: "main",
      profileImage: data.photo_url || "",
      isApproved,
      isActive: data.active !== false,
      emailVerified: Boolean(caller.emailConfirmedAt),
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
    const resolution = await resolveVerifiedCaller(request);
    if (resolution.status === "unavailable") {
      return NextResponse.json({ error: "Authentication provider error" }, { status: 503 });
    }
    if (resolution.status !== "ok") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const caller = resolution.caller;
    // A profile write depends on the identity, so a confirmed address is required before any read.
    if (!caller.email || !isConfirmedEmail(caller.emailConfirmedAt)) {
      return NextResponse.json({ error: EMAIL_NOT_VERIFIED_MESSAGE }, { status: 403 });
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
    // Match on `auth_user_id` only — the same rule /api/auth/me applies. A row whose `id` equals
    // the Auth UID has never been linked, so it is not the caller's row.
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id, role, active")
      .eq("auth_user_id", caller.uid)
      .maybeSingle();

    if (checkError) {
      console.error("[POST /api/auth/profile] User check error:", checkError.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const updateFields: Record<string, unknown> = {
      // The address is taken from the verified identity, never from the request body: it is what
      // the conflict check above queried, and a client-chosen value would let a caller store an
      // address another row already holds while the check saw a different one.
      email: caller.email || "",
      display_name: payload.name || "",
      phone_number: payload.phone || "",
      photo_url: payload.profileImage || "",
      updated_at: new Date().toISOString(),
    };

    if (existingUser) {
      // Preserve existing role, approval, and active status - never allow client to change them
      const { error: updateError } = await supabase
        .from("users")
        .update(updateFields)
        .eq("id", existingUser.id);

      if (updateError) {
        console.error("[POST /api/auth/profile] Profile update error:", updateError.message);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
    } else {
      // Never adopt or duplicate an existing row for this address; see lib/auth/provisioning.ts.
      const conflictCheck = await findEmailConflicts(supabase, caller.email, caller.uid);
      if (!conflictCheck.ok) {
        console.error("[POST /api/auth/profile] Email conflict check failed");
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
      if (conflictCheck.conflicts.length > 0) {
        return NextResponse.json({ error: EMAIL_CONFLICT_MESSAGE }, { status: 409 });
      }

      // New profile creation: default to devotee role, active: true, is_approved: false
      const insertData: Record<string, unknown> = {
        ...updateFields,
        role: "devotee",
        active: true,
        is_approved: false,
        created_at: new Date().toISOString(),
        auth_user_id: caller.uid,
      };

      const { error: insertError } = await supabase
        .from("users")
        .insert(insertData);

      if (insertError) {
        // A concurrent insert may have won the race. Only a row owned by this caller is success;
        // anything else fails closed instead of being adopted.
        if (isUniqueViolation(insertError)) {
          const recheck = await findOwnedRowAfterConflict<{ auth_user_id: string | null }>(
            supabase,
            caller.uid,
            "id, auth_user_id"
          );

          if (!recheck.ok) {
            console.error("[POST /api/auth/profile] Race recovery lookup failed");
            return NextResponse.json({ error: "Database error" }, { status: 500 });
          }
          if (recheck.row) {
            return NextResponse.json({ ok: true }, { status: 200 });
          }

          return NextResponse.json({ error: EMAIL_CONFLICT_MESSAGE }, { status: 409 });
        }

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

export async function PUT(request: NextRequest) {
  return POST(request);
}

