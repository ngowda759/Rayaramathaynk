import { NextRequest, NextResponse } from "next/server";
import { eventService } from "@/services/event.service";

export async function GET() {
  try {
    const events = await eventService.getEvents();
    return NextResponse.json(events);
  } catch (error) {
    console.error("[API] Error fetching events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validation
    if (!body.title || body.title.trim() === "") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!body.date && !body.startDate) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }
    
    await eventService.addEvent(body);
    return NextResponse.json({ message: "Event created successfully" }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating event:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
