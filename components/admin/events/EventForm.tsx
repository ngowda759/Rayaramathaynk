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

function toJsDate(
  value: Timestamp | { seconds: number; nanoseconds?: number } | string | number | null | undefined
): Date | null {
  if (!value) return null;

  if (typeof (value as Timestamp)?.toDate === "function") {
    return (value as Timestamp).toDate();
  }

  if (typeof (value as { seconds: number }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000);
  }

  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function toDateTimeInputs(
  timestamp?: Timestamp | { seconds: number; nanoseconds?: number } | string | null
) {
  const d = toJsDate(timestamp);

  if (!d) {
    return { date: "", time: "" };
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return { date, time };
}

function toTimestamp(date: string, time: string): Timestamp | null {
  if (!date) return null;

  const [hours, minutes] = time ? time.split(":").map(Number) : [0, 0];
  const [year, month, day] = date.split("-").map(Number);

  const combined = new Date(year, month - 1, day, hours || 0, minutes || 0);

  return Timestamp.fromDate(combined);
}

export default function EventForm({
  mode = "create",
  initialData,
}: EventFormProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const initialStart = toDateTimeInputs(initialData?.startDate);
  const initialEnd = toDateTimeInputs(initialData?.endDate);

  const [form, setForm] = useState({
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    location: initialData?.location ?? "",
    startDate: initialStart.date,
    startTime: initialStart.time,
    endDate: initialEnd.date,
    endTime: initialEnd.time,
    featured: initialData?.featured ?? false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const validationErrors: Record<string, string> = {};

    if (!form.title || form.title.trim().length < 3) {
      validationErrors.title = "Title must contain at least 3 characters.";
    }

    if (!form.description || form.description.trim().length < 10) {
      validationErrors.description = "Description must contain at least 10 characters.";
    }

    if (!form.location || form.location.trim().length < 2) {
      validationErrors.location = "Location is required.";
    }

    if (!form.startDate) {
      validationErrors.startDate = "Start date is required.";
    }

    if (!form.endDate) {
      validationErrors.endDate = "End date is required.";
    }

    if (form.startDate && form.endDate) {
      const start = toTimestamp(form.startDate, form.startTime);
      const end = toTimestamp(form.endDate, form.endTime);

      if (start && end && end.toMillis() < start.toMillis()) {
        validationErrors.endDate = "End date must be on or after the start date.";
      }
    }

    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) {
      alert("Please fix validation errors before saving.");
      return;
    }

    setLoading(true);

    try {
      const startTimestamp = toTimestamp(form.startDate, form.startTime);
      const endTimestamp = toTimestamp(form.endDate, form.endTime);

      if (!startTimestamp || !endTimestamp) {
        alert("Please provide valid start and end dates.");
        return;
      }

      if (mode === "edit" && initialData?.id) {
        await eventService.updateEvent(initialData.id, {
          title: form.title,
          description: form.description,
          location: form.location,
          startDate: startTimestamp,
          endDate: endTimestamp,
	  featured: form.featured,
          published: true,
        });
      } else {
        await eventService.addEvent({
          title: form.title,
          description: form.description,
          location: form.location,

          featured: form.featured,
          published: true,

          status: "Upcoming",

          startDate: startTimestamp,
          endDate: endTimestamp,
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
        {errors.title && (
          <p className="text-xs text-destructive">{errors.title}</p>
        )}
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
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description}</p>
        )}
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
        {errors.location && (
          <p className="text-xs text-destructive">{errors.location}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="featured"
          className="h-4 w-4 rounded border-stone-300"
          checked={form.featured}
          onChange={(e) =>
            setForm({
              ...form,
              featured: e.target.checked,
            })
          }
        />
        <Label htmlFor="featured">Featured event</Label>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <Label>Start Date</Label>

          <Input
            type="date"
            value={form.startDate}
            onChange={(e) =>
              setForm({
                ...form,
                startDate: e.target.value,
              })
            }
          />
          {errors.startDate && (
            <p className="text-xs text-destructive">{errors.startDate}</p>
          )}
        </div>

        <div>
          <Label>Start Time</Label>

          <Input
            type="time"
            value={form.startTime}
            onChange={(e) =>
              setForm({
                ...form,
                startTime: e.target.value,
              })
            }
          />
        </div>

        <div>
          <Label>End Date</Label>

          <Input
            type="date"
            value={form.endDate}
            onChange={(e) =>
              setForm({
                ...form,
                endDate: e.target.value,
              })
            }
          />
          {errors.endDate && (
            <p className="text-xs text-destructive">{errors.endDate}</p>
          )}
        </div>

        <div>
          <Label>End Time</Label>

          <Input
            type="time"
            value={form.endTime}
            onChange={(e) =>
              setForm({
                ...form,
                endTime: e.target.value,
              })
            }
          />
        </div>
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
