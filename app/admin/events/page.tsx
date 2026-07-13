"use client";
import {
  getEventStatus,
  sortEventsByDate,
} from "@/utils/event";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import EventTable from "@/components/admin/events/EventTable";
import EventStats from "@/components/admin/events/EventStats";
import SearchBox from "@/components/admin/common/SearchBox";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import { TempleEvent } from "@/types/event";
import { eventService } from "@/services/event.service";

export default function EventsPage() {
  const [events, setEvents] = useState<TempleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get events
      const data = await eventService.getEvents();
      setEvents(data);
      setError(null);
    } catch (error) {
      console.error("Failed to load events:", error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEvents();
  }, []);

  const sortedEvents = sortEventsByDate(events);
const total = sortedEvents.length;
const upcoming = sortedEvents.filter(
  (e) =>
    getEventStatus(e.startDate, e.endDate) ===
    "Upcoming"
).length;
const ongoing = sortedEvents.filter(
  (e) =>
    getEventStatus(e.startDate, e.endDate) ===
    "Ongoing"
).length;
const completed = sortedEvents.filter(
  (e) =>
    getEventStatus(e.startDate, e.endDate) ===
    "Completed"
).length;
const filteredEvents = sortedEvents.filter((event) => {
  const keyword = search.toLowerCase();
    return (
      event.title.toLowerCase().includes(keyword) ||
      event.description.toLowerCase().includes(keyword) ||
      event.location.toLowerCase().includes(keyword)
    );
  });
  return (
    <div className="space-y-8">
      {/* Header */}
      <AdminPageHeader
        title="Temple Events"
        description="Manage temple events and festivals."
        action={
          <Button asChild>
            <Link href="/admin/events/new">Add Event</Link>
          </Button>
        }
      />
      <EventStats
        total={total}
        upcoming={upcoming}
        ongoing={ongoing}
        completed={completed}
      />
      {/* Search */}
      <SearchBox
        value={search}
        onChange={setSearch}
	placeholder="Search events by title, location or description..."
      />
      {/* Table */}
      {loading ? (
        <div className="rounded-3xl border border-amber-200/50 bg-white p-12 shadow-lg">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-300 border-t-transparent" />
            <p className="text-stone-500">Loading events...</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200/50 bg-red-50/50 p-8 shadow-lg">
          <h3 className="text-lg font-semibold text-red-700">Failed to load events</h3>
          <p className="mt-2 text-sm text-stone-600">{error}</p>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-3xl border border-amber-200/50 bg-white p-12 shadow-lg text-center">
          <h3 className="text-lg font-semibold text-stone-700">No events found</h3>
          <p className="mt-2 text-sm text-stone-500">Add your first event using the &quot;Add Event&quot; button above.</p>
        </div>
      ) : (
        <EventTable events={filteredEvents} onEventsChanged={loadEvents} />
      )}
    </div>
  );
}
