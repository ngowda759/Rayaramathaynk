"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Plus, X, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import { Aaradhane, AaradhaneSeva } from "@/types/aaradhane";
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
  const [dateInput, setDateInput] = useState("");
  const [sevaName, setSevaName] = useState("");
  const [sevaPrice, setSevaPrice] = useState("");
  const [sevaDescription, setSevaDescription] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await aaradhaneService.getAaradhaneById(aaradhaneId);
        if (!data) {
          router.push("/admin/aaradhane");
          return;
        }
        // Initialize dates array if not present
        if (!data.dates) {
          data.dates = [];
        }
        if (!data.sevaDetails) {
          data.sevaDetails = [];
        }
        if (!data.imageUrl) {
          data.imageUrl = "";
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
    if (!item.dates || item.dates.length === 0) next.dates = "At least one date is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function updateField<K extends keyof Aaradhane>(field: K, value: Aaradhane[K]) {
    if (!item) return;
    setItem({ ...item, [field]: value });
  }

  function addDate() {
    if (!item || !dateInput) return;
    if (item.dates.includes(dateInput)) return;
    updateField("dates", [...item.dates, dateInput]);
    setDateInput("");
  }

  function removeDate(d: string) {
    if (!item) return;
    updateField("dates", item.dates.filter((x) => x !== d));
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

  function addSeva() {
    if (!item || !sevaName.trim()) return;
    const newSeva: AaradhaneSeva = {
      id: Date.now().toString(),
      name: sevaName.trim(),
      price: parseFloat(sevaPrice) || 0,
      description: sevaDescription.trim(),
    };
    updateField("sevaDetails", [...item.sevaDetails, newSeva]);
    setSevaName("");
    setSevaPrice("");
    setSevaDescription("");
  }

  function removeSeva(id: string) {
    if (!item) return;
    updateField("sevaDetails", item.sevaDetails.filter((s) => s.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item || !validate()) return;

    setSaving(true);
    try {
      await aaradhaneService.updateAaradhane(item.id, {
        title: item.title.trim(),
        guruName: item.guruName.trim(),
        dates: item.dates,
        description: item.description.trim(),
        significance: item.significance.trim(),
        rituals: item.rituals,
        offerings: item.offerings,
        imageUrl: item.imageUrl,
        sevaDetails: item.sevaDetails,
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
            <Label>Dates <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={addDate}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {item.dates && item.dates.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {item.dates.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800"
                  >
                    {new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    <button
                      type="button"
                      onClick={() => removeDate(d)}
                      className="ml-1 hover:text-amber-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {errors.dates && (
              <p className="text-xs text-destructive">{errors.dates}</p>
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
            <Label htmlFor="imageUrl">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Image Filename (JPG)
              </div>
            </Label>
            <div className="flex gap-2">
              <Input
                id="imageUrl"
                value={item.imageUrl || ""}
                onChange={(e) => updateField("imageUrl", e.target.value)}
                placeholder="e.g., aaradhane-1.jpg"
              />
              {item.imageUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => updateField("imageUrl", "")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Add images to public/images/aaradhane/ in GitHub repo, then enter filename here
            </p>
            {item.imageUrl && (
              <div className="mt-2 relative h-32 sm:h-40 md:h-48 w-full overflow-hidden rounded-lg border">
                <img
                  src={`/images/aaradhane/${item.imageUrl}`}
                  alt="Aaradhane preview"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

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
            {item.rituals && item.rituals.length > 0 && (
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
            {item.offerings && item.offerings.length > 0 && (
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

          {/* Seva Details Section */}
          <div className="space-y-2 rounded-lg border p-4">
            <Label className="text-base font-semibold">Seva Details</Label>
            <p className="text-xs text-muted-foreground">
              Add sevas available for this aaradhane
            </p>
            
            <div className="grid gap-2 pt-2">
              <Input
                value={sevaName}
                onChange={(e) => setSevaName(e.target.value)}
                placeholder="Seva name (e.g., Kanike Seva)"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  value={sevaPrice}
                  onChange={(e) => setSevaPrice(e.target.value)}
                  placeholder="Price (₹)"
                />
                <Input
                  value={sevaDescription}
                  onChange={(e) => setSevaDescription(e.target.value)}
                  placeholder="Short description"
                />
              </div>
              <Button type="button" variant="outline" onClick={addSeva} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Seva
              </Button>
            </div>

            {item.sevaDetails && item.sevaDetails.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label className="text-sm font-medium">Added Sevas:</Label>
                {item.sevaDetails.map((seva) => (
                  <div
                    key={seva.id}
                    className="flex items-center justify-between rounded-lg bg-amber-50 p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{seva.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ₹{seva.price} - {seva.description || "No description"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSeva(seva.id)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
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
