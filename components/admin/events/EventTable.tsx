import Link from "next/link";
import { Pencil } from "lucide-react";

import { TempleEvent } from "@/types/event";
import EventStatusBadge from "./EventStatusBadge";
import DeleteEventDialog from "./DeleteEventDialog";
import { formatEventDate } from "@/lib/date";

interface Props {
  events: TempleEvent[];
}

export default function EventTable({ events }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <table className="w-full table-auto">
        <thead className="bg-stone-100">
          <tr>
            <th className="px-6 py-4 text-left">Title</th>
            <th className="px-6 py-4 text-left">Date</th>
            <th className="px-6 py-4 text-left">Location</th>
            <th className="px-6 py-4 text-left">Featured</th>
            <th className="px-6 py-4 text-left">Status</th>
            <th className="px-6 py-4 text-left">Actions</th>
          </tr>
        </thead>

        <tbody>
          {events.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-6 py-10 text-center text-stone-500"
              >
                No events found.
              </td>
            </tr>
          ) : (
            events.map((event) => (
              <tr
                key={event.id}
                className="border-t hover:bg-stone-50"
              >
                {/* Title */}
                <td className="px-6 py-4 font-medium">
                  {event.title}
                </td>

                {/* Date */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {formatEventDate(event.startDate)}
                </td>

                {/* Location */}
                <td className="px-6 py-4">
                  {event.location}
                </td>

                {/* Featured */}
                <td className="px-6 py-4">
                  {event.featured ? "⭐ Yes" : "No"}
                </td>

                {/* Status */}
                <td className="px-6 py-4">
                  <EventStatusBadge status={event.status} />
                </td>

                {/* Actions */}
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/events/${event.id}/edit`}
                      className="inline-flex items-center gap-2 rounded-lg bg-orange-100 px-3 py-2 text-sm text-orange-700 hover:bg-orange-200"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Link>

                    {event.id && (
                      <DeleteEventDialog
                        id={event.id}
                        title={event.title}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
