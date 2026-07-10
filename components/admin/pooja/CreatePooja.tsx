"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Flame, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { POOJA_CATEGORIES, WEEKDAYS } from "@/types/pooja";
import { poojaService } from "@/services/pooja.service";

export default function CreatePooja() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [sevaAmount, setSevaAmount] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [notes, setNotes] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>(["All"]);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState("");
  const [submissionError, setSubmissionError] = useState("");

  function validate() {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Title is required";
    if (!startTime.trim()) next.startTime = "Start time is required";
    if (!category) next.category = "Category is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function toggleDay(day: string) {
    if (day === "All") {
      setSelectedDays(["All"]);
      return;
    }
    let next = selectedDays.filter((d) => d !== "All");
    if (next.includes(day)) {
      next = next.filter((d) => d !== day);
    } else {
      next = [...next, day];
    }
    if (next.length === 0) next = ["All"];
    if (next.length === 7) next = ["All"];
    setSelectedDays(next);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthError("");
    setSubmissionError("");
    if (!validate()) return;
    if (authLoading) {
      setAuthError("Checking authentication, please wait.");
      return;
    }
    if (!user?.email) {
      setAuthError("You must be signed in to add a pooja.");
      return;
    }

    setSaving(true);
    try {
      await poojaService.createPooja(
        {
          title: title.trim(),
          description: description.trim(),
          startTime: startTime.trim(),
          duration: duration.trim(),
          category: category as any,
          sevaAmount: parseFloat(sevaAmount || "0"),
          isActive,
          displayOrder,
          days: selectedDays,
          notes: notes.trim(),
        },
        user.email
      );
      router.push("/admin/pooja");
    } catch (err) {
      console.error("Failed to create pooja:", err);
      setSubmissionError(
        "Unable to save the pooja right now. Please try again or refresh the page."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">
              Pooja Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Kakada Arati, Abhisheka, Maha Mangalarathi"
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
              placeholder="Brief description of the pooja and its significance..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">
                Start Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="e.g., 06:00 AM"
              />
              {errors.startTime && (
                <p className="text-xs text-destructive">{errors.startTime}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., 30 minutes"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">
              Category <span className="text-destructive">*</span>
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {POOJA_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category}</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="sevaAmount">Seva Amount (₹)</Label>
            <Input
              id="sevaAmount"
              type="number"
              value={sevaAmount}
              onChange={(e) => setSevaAmount(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Leave as 0 if no seva amount applies.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayOrder">Display Order</Label>
            <Input
              id="displayOrder"
              type="number"
              value={displayOrder}
              onChange={(e) =>
                setDisplayOrder(parseInt(e.target.value || "0", 10))
              }
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first in the schedule.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="active">Active</Label>
              <p className="text-xs text-muted-foreground">
                Show this pooja in the daily schedule
              </p>
            </div>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="space-y-2">
            <Label>Applicable Days</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedDays(["All"])}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selectedDays.includes("All")
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                All Days
              </button>
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selectedDays.includes(day)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes, special instructions, or prerequisites..."
              rows={3}
            />
          </div>
        </div>
      </div>

      {authError ? (
        <p className="text-sm text-destructive">{authError}</p>
      ) : null}
      {submissionError ? (
        <p className="text-sm text-destructive">{submissionError}</p>
      ) : null}

      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/pooja")}
          disabled={saving}
        >
          Cancel
        </Button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center font-medium transition disabled:opacity-50 disabled:cursor-not-allowed bg-orange-600 hover:bg-orange-700 text-white h-11 rounded-lg px-4 py-3"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Flame className="mr-2 h-4 w-4" />
              Add Pooja
            </>
          )}
        </button>
      </div>
    </form>
  );
}
