import { NextRequest, NextResponse } from "next/server";
import { storageService } from "@/services/storage.service";

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const filename = formData.get('filename') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Missing video file' },
        { status: 400 }
      );
    }

    if (filename && filename.includes('..')) {
      return NextResponse.json(
        { error: 'Path traversal is not allowed in filename.' },
        { status: 400 }
      );
    }

    const fileType = file.type;
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/ogg'];

    // Always allow octet-stream for generic files if the client doesn't know,
    // but ideally we only want videos here.
    if (!validVideoTypes.includes(fileType) && fileType !== 'application/octet-stream' && !fileType.startsWith('video/')) {
       return NextResponse.json(
        { error: 'Invalid video mime type.' },
        { status: 400 }
      );
    }

    const result = await storageService.uploadVideo(file, filename || undefined);

    return NextResponse.json({
      success: true,
      url: result.url,
      pathname: result.pathname,
    });
  } catch (error) {
    console.error("Error in storage video upload:", error);
    return NextResponse.json(
      { error: "Failed to upload video. Please try again." },
      { status: 500 }
    );
  }
}
