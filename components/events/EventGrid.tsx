"use client";

import { useEffect, useState } from "react";
import { TempleEvent } from "@/types/event";
import { eventService } from "@/services/event.service";
import EventCard from "./EventCard";
import { ChevronDown } from "lucide-react";

interface Props {
  limit?: number;
}

type EventFilter = "upcoming" | "past";

function toDate(date: any): Date {
  if (!date) return new Date(0);
  if (date instanceof Date) return date;
  if (typeof date === 'string') return new Date(date);
  if (typeof date === 'number') return new Date(date);
  if (date.toDate && typeof date.toDate === 'function') return date.toDate();
  return new Date(0);
}

export default function EventGrid({ limit }: Props) {
  const [events, setEvents] = useState<TempleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<EventFilter>("upcoming");

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

  const filteredEvents = events.filter((event) => {
    const eventDate = toDate(event.startDate);
    const now = new Date();
    
    if (filter === "upcoming") {
      return eventDate >= now;
    } else {
      return eventDate < now;
    }
  });

  if (loading) {
    return (
      <div className="py-16 text-center text-stone-500">
        Loading events...
      </div>
    );
  }

  if (!limit) {
    return (
      <div className="space-y-8">
        {/* Filter Dropdown */}
        <div className="flex justify-center">
          <div className="relative inline-block">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as EventFilter)}
              className="appearance-none rounded-2xl border-2 border-amber-300 bg-white px-8 py-3 pr-12 text-lg font-semibold text-stone-700 shadow-sm transition hover:border-amber-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 cursor-pointer"
            >
              <option value="upcoming">Upcoming Events</option>
              <option value="past">Past Events</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-600" />
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="rounded-3xl border border-dashed p-16 text-center">
            <h3 className="text-2xl font-semibold">
              No {filter === "upcoming" ? "Upcoming" : "Past"} Events
            </h3>
            <p className="mt-4 text-stone-600">
              {filter === "upcoming"
                ? "Please check back again soon for upcoming spiritual programs and festivals."
                : "No past events to display at this time."}
            </p>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed p-16 text-center">
        <h3 className="text-2xl font-semibold">No Events</h3>
        <p className="mt-4 text-stone-600">
          Please check back again soon for spiritual programs and festivals.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
