"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { eventService } from "@/services/event.service";
import { Button } from "@/components/ui/button";

interface Props {
  id: string;
  title: string;
}

export default function DeleteEventDialog({
  id,
  title,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${title}"?`)) return;

    try {
      setLoading(true);

      await eventService.deleteEvent(id);

      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Unable to delete event.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={loading}
      onClick={handleDelete}
    >
      {loading ? "Deleting..." : "Delete"}
    </Button>
  );
}
