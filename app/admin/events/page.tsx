"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import EventTable from "@/components/admin/events/EventTable";

import { TempleEvent } from "@/types/event";
import { eventService } from "@/services/event.service";

export default function EventsPage() {
  const [events, setEvents] = useState<TempleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadEvents() {
    try {
      const data = await eventService.getEvents();
      console.log("Events loaded:", data);
      setEvents(data);
    } catch (error) {
      console.error("Failed to load events:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Temple Events
          </h1>

          <p className="text-stone-500">
            Manage temple events and festivals.
          </p>
        </div>
	<Link href="/admin/events/new">
  	<Button>
    	Add Event
  	</Button>
	</Link>

      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-8">
          Loading events...
        </div>
      ) : (
        <EventTable events={events} />
      )}
    </div>
  );
}
