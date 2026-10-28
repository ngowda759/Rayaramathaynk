import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { announcementService } from "@/services/announcement.server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const announcement = await announcementService.getAnnouncement(id);
  if (!announcement) {
    return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  }
  return NextResponse.json(announcement);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await announcementService.updateAnnouncement(id, await request.json());
    return NextResponse.json({ message: "Announcement updated successfully" });
  } catch (error) {
    console.error("[announcements/:id] update failed:", error);
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 });
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
    await announcementService.deleteAnnouncement(id);
    return NextResponse.json({ message: "Announcement deleted successfully" });
  } catch (error) {
    console.error("[announcements/:id] delete failed:", error);
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}
