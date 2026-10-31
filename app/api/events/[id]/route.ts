import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { allowPublicWrite } from "@/lib/api/public-rate-limit";
import { eventUpdateSchema } from "@/lib/validation/public-submissions";
import { parseJsonBody } from "@/lib/validation/http";
import { eventService } from "@/services/event.service";

/**
 * GET    /api/events/[id] - public read of a single *published* event.
 * PATCH  /api/events/[id] - update an event (admin only).
 * DELETE /api/events/[id] - delete an event (admin only).
 *
 * Reads are restricted to published events so an unpublished draft cannot be
 * enumerated anonymously. Writes are administrative and guarded with the same
 * `requireAdminUser` check the `/api/admin/**` routes use; previously PATCH and
 * DELETE were reachable by anyone.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = await eventService.getPublishedEvent(id);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json(event);
  } catch (error) {
    console.error("[API] Error fetching event:", error);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  if (!allowPublicWrite(request, { scope: "events:update", identity: auth.user.uid, limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, eventUpdateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { id } = await params;
    const updated = await eventService.updateEvent(id, parsed.data);
    if (!updated) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    return NextResponse.json({ message: "Event updated successfully" });
  } catch (error) {
    console.error("[API] Error updating event:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  if (!allowPublicWrite(request, { scope: "events:delete", identity: auth.user.uid, limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { id } = await params;
    const existing = await eventService.getEvent(id);
    if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    await eventService.deleteEvent(id);
    return NextResponse.json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("[API] Error deleting event:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
