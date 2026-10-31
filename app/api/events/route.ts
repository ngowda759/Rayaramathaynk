import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { allowPublicWrite } from "@/lib/api/public-rate-limit";
import { eventCreateSchema } from "@/lib/validation/public-submissions";
import { parseJsonBody } from "@/lib/validation/http";
import { eventService } from "@/services/event.service";

/**
 * GET  /api/events - public read of published events.
 * POST /api/events - create an event (admin only).
 *
 * The create is an administrative operation: it has no public submission flow, so it
 * is guarded with the same `requireAdminUser` check the `/api/admin/**` routes use.
 * Before this guard existed, an anonymous caller could insert rows into `events`.
 */
export async function GET() {
  try {
    const events = await eventService.getPublishedEvents();
    return NextResponse.json(events);
  } catch (error) {
    console.error("[API] Error fetching events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  if (!allowPublicWrite(request, { scope: "events:create", identity: auth.user.uid, limit: 30, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, eventCreateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const startDate = parsed.data.startDate ?? parsed.data.date!;
    await eventService.addEvent({
      title: parsed.data.title,
      description: parsed.data.description,
      location: parsed.data.location,
      startDate,
      endDate: parsed.data.endDate ?? startDate,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      featured: parsed.data.featured,
      published: parsed.data.published,
      category: parsed.data.category,
      imageUrl: parsed.data.imageUrl,
      status: parsed.data.status,
    });
    return NextResponse.json({ message: "Event created successfully" }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating event:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
