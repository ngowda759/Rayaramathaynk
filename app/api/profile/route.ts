import { NextRequest, NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { profileService } from "@/services/profile.server";

/**
 * The signed-in caller's own devotee profile.
 *
 * The profile key is the verified Firebase ID token's `uid`, never a value from the
 * request body, so a caller can only read or write their own profile.
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
  try {
    return NextResponse.json(await profileService.saveProfile(uid, await request.json()));
  } catch (error) {
    console.error("[profile] save failed:", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const uid = await callerUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await profileService.updateProfile(uid, await request.json());
    return NextResponse.json({ message: "Profile updated" });
  } catch (error) {
    console.error("[profile] update failed:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
