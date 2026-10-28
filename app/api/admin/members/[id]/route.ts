import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { memberService } from "@/services/volunteer.server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const member = await memberService.getMemberById(id);
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  return NextResponse.json(member);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await memberService.updateMember(id, await request.json());
    return NextResponse.json({ message: "Member updated" });
  } catch (error) {
    console.error("[admin/members/:id] update failed:", error);
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await memberService.deleteMember(id);
    return NextResponse.json({ message: "Member deleted" });
  } catch (error) {
    console.error("[admin/members/:id] delete failed:", error);
    return NextResponse.json({ error: "Failed to delete member" }, { status: 500 });
  }
}
