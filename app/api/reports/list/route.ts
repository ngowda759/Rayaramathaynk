import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin-auth";
import { storageService } from "@/services/storage.service";

export const runtime = 'nodejs';

/**
 * List reports in Vercel Blob storage. Admin-only: the reports bucket holds
 * generated screenshots/PDFs, so anonymous enumeration is not permitted.
 *
 * GET /api/reports/list?prefix=screenshot
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

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
