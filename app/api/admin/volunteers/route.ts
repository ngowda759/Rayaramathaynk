import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { volunteerService } from "@/services/volunteer.server";

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await volunteerService.getAllVolunteers());
  } catch (error) {
    console.error("[admin/volunteers] read failed:", error);
    return NextResponse.json({ error: "Failed to read volunteers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  try {
    const id = await volunteerService.createVolunteer(await request.json());
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[admin/volunteers] create failed:", error);
    return NextResponse.json({ error: "Failed to create volunteer" }, { status: 500 });
  }
}
