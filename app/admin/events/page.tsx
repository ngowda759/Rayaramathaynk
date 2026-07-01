"use client";

import { useEffect, useState } from "react";
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

  async function loadEvents() {
    try {
      const data = await eventService.getEvents();
      setEvents(data);
    } catch (error) {
      console.error("Failed to load events:", error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  const total = events.length;

  const upcoming = events.filter(
    (e) => e.status === "Upcoming"
  ).length;

  const ongoing = events.filter(
    (e) => e.status === "Ongoing"
  ).length;

  const completed = events.filter(
    (e) => e.status === "Completed"
  ).length;

  const filteredEvents = events.filter((event) => {
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
        <EventTable events={filteredEvents} />
      )}

    </div>
  );
}
