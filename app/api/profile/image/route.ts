import { NextRequest, NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { allowPublicWrite } from "@/lib/api/public-rate-limit";
import { profileService } from "@/services/profile.server";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Uploads or removes the signed-in caller's own profile image.
 *
 * The upload target is the verified token's uid, so a caller can only change their own
 * image. The file must be a real image under 5 MB: the browser's own check is a
 * convenience, not a control, so it is enforced again here.
 */
export async function POST(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!allowPublicWrite(request, { scope: "profile:image", identity: caller.uid, limit: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, WebP or GIF images are allowed" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image must be smaller than 5 MB" }, { status: 400 });
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
