import { NextRequest, NextResponse } from "next/server";
import { storageService, UploadFolder } from "@/services/storage.service";

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const base64 = formData.get('base64') as string | null;
    const filename = formData.get('filename') as string | null;

    if (!base64 || !filename) {
      return NextResponse.json(
        { error: 'Missing base64 data or filename' },
        { status: 400 }
      );
    }

    if (filename.includes('..') || filename.includes('/') || filename.includes('%2e')) {
      return NextResponse.json(
        { error: 'Path traversal is not allowed in filename.' },
        { status: 400 }
      );
    }

    const result = await storageService.uploadBase64Image(base64, filename, 'testimonials');

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
