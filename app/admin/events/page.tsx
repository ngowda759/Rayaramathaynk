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
    console.log("[Events] Starting to load events...");
    try {
      setLoading(true);
      console.log("[Events] Calling eventService.getEvents()...");
      const data = await eventService.getEvents();
      console.log("[Events] Received data:", data);
      setEvents(data);
      setError(null);
      console.log("[Events] Events state updated");
    } catch (error) {
      console.error("[Events] Failed to load events:", error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
      console.log("[Events] Loading complete");
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
        <div className="rounded-xl border bg-white p-8">
          Loading events...
        </div>
      ) : error ? (
        <div className="rounded-xl border bg-white p-8">
          <h3 className="text-lg font-semibold text-destructive">Failed to load events</h3>
          <p className="mt-2 text-sm text-stone-600">{error}</p>
        </div>
      ) : (
        <EventTable events={filteredEvents} onEventsChanged={loadEvents} />
      )}
    </div>
  );
}
