import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { aaradhaneService } from "@/services/aaradhane.server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const item = await aaradhaneService.getAaradhaneById(id);
  if (!item) return NextResponse.json({ success: false, error: "Aaradhane not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: item });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await aaradhaneService.updateAaradhane(id, await request.json());
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/aaradhane/:id] update failed:", error);
    return NextResponse.json({ success: false, error: "Failed to update aaradhane" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await aaradhaneService.deleteAaradhane(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/aaradhane/:id] delete failed:", error);
    return NextResponse.json({ success: false, error: "Failed to delete aaradhane" }, { status: 500 });
  }
}
