import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { volunteerService } from "@/services/volunteer.server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const volunteer = await volunteerService.getVolunteerById(id);
  if (!volunteer) return NextResponse.json({ error: "Volunteer not found" }, { status: 404 });
  return NextResponse.json(volunteer);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await volunteerService.updateVolunteer(id, await request.json());
    return NextResponse.json({ message: "Volunteer updated" });
  } catch (error) {
    console.error("[admin/volunteers/:id] update failed:", error);
    return NextResponse.json({ error: "Failed to update volunteer" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await volunteerService.deleteVolunteer(id);
    return NextResponse.json({ message: "Volunteer deleted" });
  } catch (error) {
    console.error("[admin/volunteers/:id] delete failed:", error);
    return NextResponse.json({ error: "Failed to delete volunteer" }, { status: 500 });
  }
}
