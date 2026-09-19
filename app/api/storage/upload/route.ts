import { NextRequest, NextResponse } from "next/server";
import { storageService, UploadFolder } from "@/services/storage.service";

export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_FOLDERS = ['testimonials', 'gallery', 'videos', 'aaradhane', 'events', 'profile', 'donations', 'sevas', 'reports'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Check if this is a file upload or base64 upload
    const file = formData.get('file') as File | null;
    const base64 = formData.get('base64') as string | null;
    const filename = formData.get('filename') as string | null;
    let folder = formData.get('folder') as string | null || 'gallery';

    if (!ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json(
        { error: `Invalid folder. Must be one of: ${ALLOWED_FOLDERS.join(', ')}` },
        { status: 400 }
      );
    }

    if (filename && filename.includes('..')) {
      return NextResponse.json(
        { error: 'Path traversal is not allowed in filename.' },
        { status: 400 }
      );
    }

    let result;

    if (file) {
      if (!filename) {
         return NextResponse.json(
          { error: 'filename is required when uploading a file' },
          { status: 400 }
        );
      }
      result = await storageService.uploadFile(file, filename, folder as UploadFolder);
    } else if (base64) {
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
