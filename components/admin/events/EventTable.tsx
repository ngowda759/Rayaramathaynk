import { TempleEvent } from "@/types/event";
import EventStatusBadge from "./EventStatusBadge";

interface Props {
  events: TempleEvent[];
}

export default function EventTable({ events }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <table className="min-w-full">
        <thead className="bg-stone-100">
          <tr>
            <th className="px-6 py-4 text-left">Title</th>
            <th className="px-6 py-4 text-left">Location</th>
            <th className="px-6 py-4 text-left">Featured</th>
            <th className="px-6 py-4 text-left">Status</th>
          </tr>
        </thead>

        <tbody>
          {events.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-6 py-10 text-center text-stone-500"
              >
                No events found.
              </td>
            </tr>
          ) : (
            events.map((event) => (
              <tr key={event.id} className="border-t hover:bg-stone-50">
                <td className="px-6 py-4 font-medium">
                  {event.title}
                </td>

                <td className="px-6 py-4">
                  {event.location}
                </td>

                <td className="px-6 py-4">
                  {event.featured ? "⭐ Yes" : "No"}
                </td>

                <td className="px-6 py-4">
                  <EventStatusBadge status={event.status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
