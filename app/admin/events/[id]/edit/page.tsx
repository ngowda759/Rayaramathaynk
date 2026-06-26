import { notFound } from "next/navigation";

import EventForm from "@/components/admin/events/EventForm";
import { eventService } from "@/services/event.service";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditEventPage({
  params,
}: Props) {
  const { id } = await params;

  const event = await eventService.getEvent(id);

  if (!event) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Edit Event
        </h1>

        <p className="text-stone-500">
          Update temple event information.
        </p>
      </div>

      <EventForm
        mode="edit"
        initialData={event}
      />
    </div>
  );
}
