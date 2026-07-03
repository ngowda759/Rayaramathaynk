"use client";

import { useEffect, useState } from "react";
import { TempleEvent } from "@/types/event";
import { eventService } from "@/services/event.service";
import EventCard from "./EventCard";

interface Props {
  limit?: number;
}

export default function EventGrid({ limit }: Props) {
  const [events, setEvents] = useState<TempleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = limit
          ? await eventService.getUpcomingEvents(limit)
          : await eventService.getPublishedEvents();

        setEvents(data);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [limit]);

  if (loading) {
    return (
      <div className="py-16 text-center text-stone-500">
        Loading upcoming events...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed p-16 text-center">
        <h3 className="text-2xl font-semibold">
          No Upcoming Events
        </h3>

        <p className="mt-4 text-stone-600">
          Please check back again soon for upcoming
          spiritual programs and festivals.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
        />
      ))}
    </div>
  );
}
