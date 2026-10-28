import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { announcementService } from "@/services/announcement.server";

/**
 * Announcements. Reading is public website content; creating one requires an
 * authenticated administrator. `?active=1` limits the list to active rows.
 */
export async function GET(request: NextRequest) {
  try {
    const active = request.nextUrl.searchParams.get("active") === "1";
    const announcements = active
      ? await announcementService.getActiveAnnouncements()
      : await announcementService.getAnnouncements();
    return NextResponse.json(announcements);
  } catch (error) {
    console.error("[announcements] read failed:", error);
    return NextResponse.json({ error: "Failed to fetch announcements" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    if (!body?.title || String(body.title).trim() === "") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    const id = await announcementService.addAnnouncement(body);
    return NextResponse.json({ id, message: "Announcement created successfully" }, { status: 201 });
  } catch (error) {
    console.error("[announcements] create failed:", error);
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}
