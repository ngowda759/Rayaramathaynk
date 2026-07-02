"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import CrudTable from "@/components/admin/crud/CrudTable";

import { TempleEvent } from "@/types/event";
import { eventService } from "@/services/event.service";

import { eventColumns } from "@/app/admin/events/columns";

interface Props {
  events: TempleEvent[];
  onEventsChanged?: () => void;
}

export default function EventTable({
  events,
  onEventsChanged,
}: Props) {
  const router = useRouter();

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(event: TempleEvent) {
    if (!event.id) return;

    if (!confirm(`Delete "${event.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(event.id);

      await eventService.deleteEvent(event.id);

      onEventsChanged?.();
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Unable to delete event.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <CrudTable<TempleEvent>
      data={events}
      columns={eventColumns}
      emptyMessage="No events found."
      actions={{
        onEdit: (event) => {
          router.push(`/admin/events/${event.id}/edit`);
        },

        onDelete: (event) => {
          handleDelete(event);
        },
      }}
    />
  );
}
