import EventForm from "@/components/admin/events/EventForm";

export default function NewEventPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Add Event
        </h1>

        <p className="text-stone-500">
          Create a new temple event.
        </p>
      </div>

      <EventForm />
    </div>
  );
}
