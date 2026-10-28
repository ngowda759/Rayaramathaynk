import { NextRequest, NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { profileService } from "@/services/profile.server";

export async function POST(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    const url = await profileService.uploadProfileImage(caller.uid, file);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[profile/image] upload failed:", error);
    return NextResponse.json({ error: "Failed to upload profile image" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await profileService.deleteProfileImage(caller.uid);
    return NextResponse.json({ message: "Profile image removed" });
  } catch (error) {
    console.error("[profile/image] delete failed:", error);
    return NextResponse.json({ error: "Failed to remove profile image" }, { status: 500 });
  }
}
