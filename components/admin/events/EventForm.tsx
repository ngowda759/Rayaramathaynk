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

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [saveError, setSaveError] = useState<string | null>(null);

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

    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) {
      setSaveError("Please fix the validation errors before saving.");
      return;
    }

    setSaveError(null);
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
  	  published: true,

  	  status: "Upcoming",

  	  startDate: now,
  	  endDate: now,
	});
	
      }

      router.push("/admin/events");
      router.refresh();
    } catch (err) {
      console.error("[event-save] Failed to save event:", err);

      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: string }).code)
          : "";

      const message =
        code === "permission-denied"
          ? "You do not have permission to save events. Please make sure you are signed in as an admin and that your Firestore security rules allow authenticated writes to the events collection."
          : err instanceof Error && err.message
          ? `Unable to save event: ${err.message}`
          : "Unable to save event. Please try again.";

      setSaveError(message);
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


      {saveError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {saveError}
        </p>
      )}

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
