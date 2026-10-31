import { NextRequest, NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { allowPublicWrite } from "@/lib/api/public-rate-limit";
import { verifyImageSignature } from "@/lib/validation/image-signature";
import { profileService } from "@/services/profile.server";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_LABEL = "JPEG, PNG, WebP or GIF";

/**
 * Uploads or removes the signed-in caller's own profile image.
 *
 * The upload target is the verified token's uid, so a caller can only change their own
 * image. The file must be a real image under 5 MB: the browser's own check is a
 * convenience, not a control, so it is enforced again here — including the file's magic
 * bytes, because a declared `Content-Type` can be forged by renaming any file.
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
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image must be smaller than 5 MB" }, { status: 400 });
    }

    // Inspect the actual bytes, not just the declared type.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const signature = verifyImageSignature(bytes, file.type);
    if (!signature.ok) {
      return NextResponse.json(
        { error: `Only ${ALLOWED_IMAGE_LABEL} images are allowed`, details: signature.reason },
        { status: 400 }
      );
    }

    // Store the sniffed type, so a forged or absent Content-Type cannot mislabel the object.
    const normalized = new File([bytes], file.name, { type: signature.detected });
    const url = await profileService.uploadProfileImage(caller.uid, normalized);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[profile/image] upload failed:", error);
    return NextResponse.json({ error: "Failed to upload profile image" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!allowPublicWrite(request, { scope: "profile:image:delete", identity: caller.uid, limit: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    await profileService.deleteProfileImage(caller.uid);
    return NextResponse.json({ message: "Profile image removed" });
  } catch (error) {
    console.error("[profile/image] delete failed:", error);
    return NextResponse.json({ error: "Failed to remove profile image" }, { status: 500 });
  }
}
