"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import { Aaradhane } from "@/types/aaradhane";
import { aaradhaneService } from "@/services/aaradhane.service";

interface EditAaradhaneProps {
  aaradhaneId: string;
}

export default function EditAaradhane({ aaradhaneId }: EditAaradhaneProps) {
  const router = useRouter();

  const [item, setItem] = useState<Aaradhane | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [ritualInput, setRitualInput] = useState("");
  const [offeringInput, setOfferingInput] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await aaradhaneService.getAaradhaneById(aaradhaneId);
        if (!data) {
          router.push("/admin/aaradhane");
          return;
        }
        setItem(data);
      } catch (err) {
        console.error("Failed to load aaradhane:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [aaradhaneId, router]);

  function validate() {
    const next: Record<string, string> = {};
    if (!item) return false;
    if (!item.title.trim()) next.title = "Title is required";
    if (!item.guruName.trim()) next.guruName = "Guru name is required";
    if (!item.date) next.date = "Date is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function updateField<K extends keyof Aaradhane>(field: K, value: Aaradhane[K]) {
    if (!item) return;
    setItem({ ...item, [field]: value });
  }

  function addRitual() {
    const trimmed = ritualInput.trim();
    if (!trimmed || !item) return;
    if (item.rituals.includes(trimmed)) return;
    updateField("rituals", [...item.rituals, trimmed]);
    setRitualInput("");
  }

  function removeRitual(r: string) {
    if (!item) return;
    updateField("rituals", item.rituals.filter((x) => x !== r));
  }

  function addOffering() {
    const trimmed = offeringInput.trim();
    if (!trimmed || !item) return;
    if (item.offerings.includes(trimmed)) return;
    updateField("offerings", [...item.offerings, trimmed]);
    setOfferingInput("");
  }

  function removeOffering(o: string) {
    if (!item) return;
    updateField("offerings", item.offerings.filter((x) => x !== o));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item || !validate()) return;

    setSaving(true);
    try {
      await aaradhaneService.updateAaradhane(item.id, {
        title: item.title.trim(),
        guruName: item.guruName.trim(),
        date: item.date,
        description: item.description.trim(),
        significance: item.significance.trim(),
        rituals: item.rituals,
        offerings: item.offerings,
        isUpcoming: item.isUpcoming,
        displayOrder: item.displayOrder,
      });
      router.push("/admin/aaradhane");
    } catch (err) {
      console.error("Failed to update aaradhane:", err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!item) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">
              Aaradhane Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={item.title}
              onChange={(e) => updateField("title", e.target.value)}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="guruName">
              Guru Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="guruName"
              value={item.guruName}
              onChange={(e) => updateField("guruName", e.target.value)}
            />
            {errors.guruName && (
              <p className="text-xs text-destructive">{errors.guruName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="date"
              type="date"
              value={item.date}
              onChange={(e) => updateField("date", e.target.value)}
            />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={item.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="significance">Significance</Label>
            <Textarea
              id="significance"
              value={item.significance}
              onChange={(e) => updateField("significance", e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="displayOrder">Display Order</Label>
            <Input
              id="displayOrder"
              type="number"
              value={item.displayOrder}
              onChange={(e) =>
                updateField("displayOrder", parseInt(e.target.value || "0", 10))
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="upcoming">Mark as Upcoming</Label>
              <p className="text-xs text-muted-foreground">
                Highlight this aaradhane as an upcoming event
              </p>
            </div>
            <Switch
              id="upcoming"
              checked={item.isUpcoming}
              onCheckedChange={(v) => updateField("isUpcoming", v)}
            />
          </div>

          <div className="space-y-2">
            <Label>Rituals</Label>
            <div className="flex gap-2">
              <Input
                value={ritualInput}
                onChange={(e) => setRitualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRitual();
                  }
                }}
                placeholder="Add a ritual and press Enter"
              />
              <Button type="button" variant="outline" onClick={addRitual}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {item.rituals.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {item.rituals.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                  >
                    {r}
                    <button
                      type="button"
                      onClick={() => removeRitual(r)}
                      className="ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Offerings</Label>
            <div className="flex gap-2">
              <Input
                value={offeringInput}
                onChange={(e) => setOfferingInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOffering();
                  }
                }}
                placeholder="Add an offering and press Enter"
              />
              <Button type="button" variant="outline" onClick={addOffering}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {item.offerings.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {item.offerings.map((o) => (
                  <span
                    key={o}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                  >
                    {o}
                    <button
                      type="button"
                      onClick={() => removeOffering(o)}
                      className="ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/aaradhane")}
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
              <Save className="mr-2 h-4 w-4" />
              Update Aaradhane
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
