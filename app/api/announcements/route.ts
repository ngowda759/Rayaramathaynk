import { NextRequest, NextResponse } from "next/server";
import { announcementService } from "@/services/announcement.service";

export async function GET() {
  try {
    const announcements = await announcementService.getAnnouncements();
    return NextResponse.json(announcements);
  } catch (error) {
    console.error("[API] Error fetching announcements:", error);
    return NextResponse.json({ error: "Failed to fetch announcements" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validation
    if (!body.title || body.title.trim() === "") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    
    await announcementService.addAnnouncement(body);
    return NextResponse.json({ message: "Announcement created successfully" }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating announcement:", error);
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}
