import { NextResponse } from "next/server";
import { storageService } from "@/services/storage.service";

/**
 * GET /api/storage/videos
 * List all videos stored in Vercel Blob at gallery/videos/
 */
export async function GET() {
  try {
    const videos = await storageService.listVideos();
    
    return NextResponse.json({
      success: true,
      count: videos.length,
      videos: videos.map((v) => ({
        url: v.url,
        pathname: v.pathname,
        size: v.size,
        sizeFormatted: formatFileSize(v.size),
        filename: v.pathname.split("/").pop(),
      })),
    });
  } catch (error) {
    console.error("[API] Error listing videos:", error);
    return NextResponse.json(
      { error: "Failed to list videos", details: String(error) },
      { status: 500 }
    );
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
