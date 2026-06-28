"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Clock3, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import { TempleTiming } from "@/types/timing";
import { timingService } from "@/services/timing.service";

interface TimingFormProps {
  initialData?: TempleTiming;
}

export default function TimingForm({ initialData }: TimingFormProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [startTime, setStartTime] = useState(initialData?.startTime || "");
  const [endTime, setEndTime] = useState(initialData?.endTime || "");
  const [order, setOrder] = useState(initialData?.order ?? 0);
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Title is required";
    if (!startTime.trim()) next.startTime = "Start time is required";
    if (!endTime.trim()) next.endTime = "End time is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (!user?.email) return;

    setSaving(true);
    try {
      const data = {
        title: title.trim(),
        description: description.trim(),
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        order,
        isActive,
      };

      if (initialData?.id) {
        await timingService.updateTiming(initialData.id, data);
      } else {
        await timingService.createTiming(data);
      }

      router.push("/admin/timings");
    } catch (err) {
      console.error("Failed to save timing:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Morning Darshan"
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Brief notes about the timing..."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="e.g., 5:30 AM"
              />
              {errors.startTime && (
                <p className="text-xs text-destructive">{errors.startTime}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="e.g., 12:30 PM"
              />
              {errors.endTime && (
                <p className="text-xs text-destructive">{errors.endTime}</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="order">Display Order</Label>
            <Input
              id="order"
              type="number"
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value || "0", 10))}
              placeholder="0"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <Label htmlFor="active">Active</Label>
              <p className="text-xs text-muted-foreground">
                Show this timing in the public schedule
              </p>
            </div>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="rounded-xl border border-dashed p-4 text-sm text-stone-600">
            <p className="font-medium">Note</p>
            <p className="mt-2">
              Active timings will be visible on the public homepage timing section.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/timings")}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Clock3 className="mr-2 h-4 w-4" />
              Save Timing
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
