"use client";

import { useState } from "react";
import { Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

import { eventService } from "@/services/event.service";
import { TempleEvent } from "@/types/event";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EventForm() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("Submit clicked");
    setLoading(true);
    const now = Timestamp.now()

    const event: TempleEvent = {
      title: form.title,
      description: form.description,
      location: form.location,
      startDate: now,
      endDate: now,
      featured: false,
      status: "Upcoming",
    };

    try {
  await eventService.addEvent(event);

  console.log("✅ Event saved successfully");

  router.push("/admin/events");
} catch (error) {
  console.error("❌ Error saving event:", error);
  alert(String(error));
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
        <Label>Event Title</Label>

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
          className="w-full rounded-md border p-3"
          rows={5}
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
        {loading ? "Saving..." : "Save Event"}
      </Button>
    </form>
  );
}
