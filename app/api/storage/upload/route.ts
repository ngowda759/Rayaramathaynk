import { verifyAdminUser } from "@/lib/auth/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { storageService, UploadFolder } from "@/services/storage.service";

export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_FOLDERS = ['testimonials', 'gallery', 'videos', 'aaradhane', 'events', 'profile', 'donations', 'sevas', 'reports'];

export async function POST(request: NextRequest) {
  const user = await verifyAdminUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();

    // Check if this is a file upload or base64 upload
    const file = formData.get('file') as File | null;
    const base64 = formData.get('base64') as string | null;
    const filename = formData.get('filename') as string | null;
    let folder = formData.get('folder') as string | null || 'gallery';

    if (!folder || folder.includes('..') || folder.includes('/') || folder.includes('%2e')) {
      return NextResponse.json(
        { error: 'Invalid folder path.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json(
        { error: `Invalid folder. Must be one of: ${ALLOWED_FOLDERS.join(', ')}` },
        { status: 400 }
      );
    }

    if (filename && (filename.includes('..') || filename.includes('/') || filename.includes('%2e') || filename.includes('\\') || filename.startsWith('.'))) {
      return NextResponse.json(
        { error: 'Path traversal is not allowed in filename.' },
        { status: 400 }
      );
    }

    let result;

    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'File size exceeds 5MB limit.' },
          { status: 413 }
        );
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedMimes.includes(file.type)) {
        return NextResponse.json(
          { error: 'Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed.' },
          { status: 400 }
        );
      }
      if (!filename) {
         return NextResponse.json(
          { error: 'filename is required when uploading a file' },
          { status: 400 }
        );
      }
      result = await storageService.uploadFile(file, filename, folder as UploadFolder);
    } else if (base64) {
      // Rough base64 size check (Base64 string length * 3/4)
      const estimatedSize = base64.length * 0.75;
      if (estimatedSize > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Image size exceeds 5MB limit.' },
          { status: 413 }
        );
      }
      if (!filename) {
         return NextResponse.json(
          { error: 'filename is required when uploading base64' },
          { status: 400 }
        );
      }
      result = await storageService.uploadBase64Image(base64, filename, folder as UploadFolder);
    } else {
      return NextResponse.json(
        { error: 'Missing file or base64 data' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      pathname: result.pathname,
    });
  } catch (error) {
    console.error("Error in storage upload:", error);
    return NextResponse.json(
      { error: "Failed to upload file. Please try again." },
      { status: 500 }
    );
  }
}
