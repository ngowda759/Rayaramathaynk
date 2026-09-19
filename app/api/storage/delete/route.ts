import { NextRequest, NextResponse } from "next/server";
import { storageService } from "@/services/storage.service";

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'Missing url to delete' },
        { status: 400 }
      );
    }

    await storageService.deleteFile(url);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error in storage delete:", error);
    return NextResponse.json(
      { error: "Failed to delete file. Please try again." },
      { status: 500 }
    );
  }
}
