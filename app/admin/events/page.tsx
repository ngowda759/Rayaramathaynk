"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import EventTable from "@/components/admin/events/EventTable";
import EventStats from "@/components/admin/events/EventStats";
import EventSearch from "@/components/admin/events/EventSearch";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";

import { TempleEvent } from "@/types/event";
import { eventService } from "@/services/event.service";

export default function EventsPage() {
  const [events, setEvents] = useState<TempleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  async function loadEvents() {
    try {
      const data = await eventService.getEvents();
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
	>
  	<Link href="/admin/events/new">
    	<Button className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700">
      	Add Event
    	</Button>
  	</Link>
	</AdminPageHeader>

      {/* Statistics */}
      <EventStats
        total={total}
        upcoming={upcoming}
        ongoing={ongoing}
        completed={completed}
      />

      {/* Search */}
      <EventSearch
        value={search}
        onChange={setSearch}
      />

      {/* Table */}
      {loading ? (
        <div className="rounded-xl border bg-white p-8">
          Loading events...
        </div>
      ) : (
        <EventTable events={filteredEvents} />
      )}

    </div>
  );
}
