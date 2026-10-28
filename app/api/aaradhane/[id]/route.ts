import { NextRequest, NextResponse } from "next/server";

import { aaradhaneService } from "@/services/aaradhane.server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const item = await aaradhaneService.getAaradhaneById(id);
    if (!item) return NextResponse.json({ error: "Aaradhane not found" }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    console.error("[aaradhane/:id] read failed:", error);
    return NextResponse.json({ error: "Failed to fetch aaradhane" }, { status: 500 });
  }
}
