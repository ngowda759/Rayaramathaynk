"use client";

import { useState } from "react";
import { Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

import { TempleEvent } from "@/types/event";
import { eventService } from "@/services/event.service";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EventFormProps {
  mode?: "create" | "edit";
  initialData?: TempleEvent;
}

export default function EventForm({
  mode = "create",
  initialData,
}: EventFormProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    location: initialData?.location ?? "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    try {
      if (mode === "edit" && initialData?.id) {
        await eventService.updateEvent(initialData.id, {
          title: form.title,
          description: form.description,
          location: form.location,
        });
      } else {
        const now = Timestamp.now();

        await eventService.addEvent({
          title: form.title,
          description: form.description,
          location: form.location,
          featured: false,
          status: "Upcoming",
          startDate: now,
          endDate: now,
        });
      }

      router.push("/admin/events");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Unable to save event.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl bg-white p-8 shadow"
    >
      <div>
        <Label>Title</Label>

        <Input
          value={form.title}
          onChange={(e) =>
            setForm({
              ...form,
              title: e.target.value,
            })
          }
        />
      </div>

      <div>
        <Label>Description</Label>

        <textarea
          rows={5}
          className="w-full rounded-md border p-3"
          value={form.description}
          onChange={(e) =>
            setForm({
              ...form,
              description: e.target.value,
            })
          }
        />
      </div>

      <div>
        <Label>Location</Label>

        <Input
          value={form.location}
          onChange={(e) =>
            setForm({
              ...form,
              location: e.target.value,
            })
          }
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading
          ? "Saving..."
          : mode === "edit"
          ? "Update Event"
          : "Save Event"}
      </Button>
    </form>
  );
}
