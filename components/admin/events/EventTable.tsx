"use client";

import { useRouter } from "next/navigation";

import CrudTable from "@/components/admin/crud/CrudTable";

import { TempleEvent } from "@/types/event";

import { eventColumns } from "@/app/admin/events/columns";

interface Props {
  events: TempleEvent[];
}

export default function EventTable({
  events,
}: Props) {
  const router = useRouter();

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
          console.log(
            "Delete Event:",
            event.id
          );

          /**
           * TODO
           * Replace this with the reusable
           * DeleteDialog framework component.
           */
        },
      }}
    />
  );
}
