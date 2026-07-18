import { NextRequest, NextResponse } from "next/server";
import { storageService } from "@/services/storage.service";

export const runtime = 'nodejs';

/**
 * List all reports in Vercel Blob storage
 * 
 * GET /api/reports/list?prefix=screenshot
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix') || undefined;

    const reports = await storageService.listReports(prefix);

    return NextResponse.json({
      success: true,
      reports,
      count: reports.length,
    });
  } catch (error) {
    console.error("Error listing reports:", error);
    return NextResponse.json(
      { error: "Failed to list reports. Please try again." },
      { status: 500 }
    );
  }
}
