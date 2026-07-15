// API Route: /api/knowledge/workflow/versions/[id]
// Version operations

import { NextRequest, NextResponse } from "next/server";
import {
  getVersionById,
  restoreToVersion,
} from "@/services/knowledge-workflow.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const version = await getVersionById(id);

    if (!version) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ version });
  } catch (error) {
    console.error("Error fetching version:", error);
    return NextResponse.json(
      { error: "Failed to fetch version" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { articleId, restoredBy } = body;

    await restoreToVersion(articleId, id, restoredBy);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error restoring version:", error);
    return NextResponse.json(
      { error: "Failed to restore version" },
      { status: 500 }
    );
  }
}
