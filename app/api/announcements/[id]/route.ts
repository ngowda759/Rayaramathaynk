import { NextRequest, NextResponse } from "next/server";
import { announcementService } from "@/services/announcement.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const announcement = await announcementService.getAnnouncement(id);
    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }
    return NextResponse.json(announcement);
  } catch (error) {
    console.error("[API] Error fetching announcement:", error);
    return NextResponse.json({ error: "Failed to fetch announcement" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    await announcementService.updateAnnouncement(id, body);
    return NextResponse.json({ message: "Announcement updated successfully" });
  } catch (error) {
    console.error("[API] Error updating announcement:", error);
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await announcementService.deleteAnnouncement(id);
    return NextResponse.json({ message: "Announcement deleted successfully" });
  } catch (error) {
    console.error("[API] Error deleting announcement:", error);
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}
