import { NextRequest, NextResponse } from "next/server";

import { requireAdminCapability } from "@/lib/auth/admin-capabilities";
import { memberService } from "@/services/volunteer.server";

export async function GET(request: NextRequest) {
  const auth = await requireAdminCapability(request, "members.read");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await memberService.getAllMembers());
  } catch (error) {
    console.error("[admin/members] read failed:", error);
    return NextResponse.json({ error: "Failed to read members" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminCapability(request, "members.write");
  if (!auth.ok) return auth.response;
  try {
    const id = await memberService.createMember(await request.json());
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[admin/members] create failed:", error);
    return NextResponse.json({ error: "Failed to create member" }, { status: 500 });
  }
}
