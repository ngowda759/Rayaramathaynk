import { NextRequest, NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { allowPublicWrite } from "@/lib/api/public-rate-limit";
import { profileSaveSchema, profileUpdateSchema } from "@/lib/validation/public-submissions";
import { parseJsonBody } from "@/lib/validation/http";
import { profileService } from "@/services/profile.server";

/**
 * The signed-in caller's own devotee profile.
 *
 * The profile key is the verified Firebase ID token's `uid`, never a value from the
 * request body, so a caller can only read or write their own profile. The body is
 * validated against an allow-list, so a caller cannot set `uid`, `email` or any other
 * column the profile service owns.
 */
async function callerUid(request: NextRequest): Promise<string | null> {
  const caller = await verifyBearerIdToken(request);
  return caller?.uid ?? null;
}

export async function GET(request: NextRequest) {
  const uid = await callerUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await profileService.getProfile(uid));
  } catch (error) {
    console.error("[profile] read failed:", error);
    return NextResponse.json({ error: "Failed to read profile" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const uid = await callerUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!allowPublicWrite(request, { scope: "profile:save", identity: uid, limit: 30, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, profileSaveSchema);
  if (!parsed.ok) return parsed.response;

  try {
    return NextResponse.json(await profileService.saveProfile(uid, parsed.data));
  } catch (error) {
    console.error("[profile] save failed:", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const uid = await callerUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!allowPublicWrite(request, { scope: "profile:update", identity: uid, limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, profileUpdateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await profileService.updateProfile(uid, parsed.data);
    return NextResponse.json({ message: "Profile updated" });
  } catch (error) {
    console.error("[profile] update failed:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
