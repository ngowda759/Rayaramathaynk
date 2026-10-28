// API Route: /api/knowledge/workflow/versions/[id]
// Version operations

import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { getVersionById, restoreToVersion } from "@/services/knowledge-workflow.service";

/** One content version, and restoring an article to it. Admin-only. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const version = await getVersionById(id);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    return NextResponse.json({ version });
  } catch (error) {
    console.error("Error fetching version:", error);
    return NextResponse.json({ error: "Failed to fetch version" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { articleId } = body;
    if (!articleId) {
      return NextResponse.json({ error: "articleId is required" }, { status: 400 });
    }

    await restoreToVersion(articleId, id, auth.user.email);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error restoring version:", error);
    return NextResponse.json({ error: "Failed to restore version" }, { status: 500 });
  }
}
