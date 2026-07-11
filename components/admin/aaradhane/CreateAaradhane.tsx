"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { BookOpen, Loader2, Plus, X, Image as ImageIcon, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import { aaradhaneService } from "@/services/aaradhane.service";
import { AaradhaneSeva } from "@/types/aaradhane";

export default function CreateAaradhane() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [guruName, setGuruName] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [dateInput, setDateInput] = useState("");
  const [description, setDescription] = useState("");
  const [significance, setSignificance] = useState("");
  const [isUpcoming, setIsUpcoming] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [imageUrl, setImageUrl] = useState("");

  const [rituals, setRituals] = useState<string[]>([]);
  const [ritualInput, setRitualInput] = useState("");

  const [offerings, setOfferings] = useState<string[]>([]);
  const [offeringInput, setOfferingInput] = useState("");

  const [sevaDetails, setSevaDetails] = useState<AaradhaneSeva[]>([]);
  const [sevaName, setSevaName] = useState("");
  const [sevaPrice, setSevaPrice] = useState("");
  const [sevaDescription, setSevaDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Title is required";
    if (!guruName.trim()) next.guruName = "Guru name is required";
    if (dates.length === 0) next.dates = "At least one date is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function addDate() {
    if (!dateInput) return;
    if (dates.includes(dateInput)) return;
    setDates([...dates, dateInput]);
    setDateInput("");
  }

  function removeDate(d: string) {
    setDates(dates.filter((x) => x !== d));
  }

  function addRitual() {
    const trimmed = ritualInput.trim();
    if (!trimmed) return;
    if (rituals.includes(trimmed)) return;
    setRituals([...rituals, trimmed]);
    setRitualInput("");
  }

  function removeRitual(r: string) {
    setRituals(rituals.filter((x) => x !== r));
  }

  function addOffering() {
    const trimmed = offeringInput.trim();
    if (!trimmed) return;
    if (offerings.includes(trimmed)) return;
    setOfferings([...offerings, trimmed]);
    setOfferingInput("");
  }

  function removeOffering(o: string) {
    setOfferings(offerings.filter((x) => x !== o));
  }

  function addSeva() {
    if (!sevaName.trim()) return;
    const newSeva: AaradhaneSeva = {
      id: Date.now().toString(),
      name: sevaName.trim(),
      price: parseFloat(sevaPrice) || 0,
      description: sevaDescription.trim(),
    };
    setSevaDetails([...sevaDetails, newSeva]);
    setSevaName("");
    setSevaPrice("");
    setSevaDescription("");
  }

  function removeSeva(id: string) {
    setSevaDetails(sevaDetails.filter((s) => s.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!validate()) {
      alert("Please fill all required fields");
      return;
    }
    
    // TEMPORARY: Use fallback if not logged in for testing
    const userEmail = user?.email || "admin@temple.com";

    setSaving(true);
    try {
      await aaradhaneService.createAaradhane(
        {
          title: title.trim(),
          description: description.trim(),
          guruName: guruName.trim(),
          dates,
          significance: significance.trim(),
          rituals,
          offerings,
          imageUrl,
          sevaDetails,
          isUpcoming,
          displayOrder,
        },
        userEmail
      );
      router.push("/admin/aaradhane");
    } catch (err) {
      console.error("Failed to create aaradhane:", err);
      alert("Error creating aaradhane: " + (err instanceof Error ? err.message : "Unknown error"));
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
              Aaradhane Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sri Raghavendra Swamy Aaradhane"
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
              value={guruName}
              onChange={(e) => setGuruName(e.target.value)}
              placeholder="e.g., Sri Raghavendra Swamy"
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
            {dates.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {dates.map((d) => (
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description of the aaradhane event..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="significance">Significance</Label>
            <Textarea
              id="significance"
              value={significance}
              onChange={(e) => setSignificance(e.target.value)}
              placeholder="Spiritual significance and importance..."
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
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="e.g., aaradhane-1.jpg"
              />
              {imageUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setImageUrl("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Add images to public/images/aaradhane/ in GitHub repo, then enter filename here
            </p>
            {imageUrl && (
              <div className="mt-2 relative h-32 sm:h-40 md:h-48 w-full overflow-hidden rounded-lg border">
                <img
                  src={`/images/aaradhane/${imageUrl}`}
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
              value={displayOrder}
              onChange={(e) =>
                setDisplayOrder(parseInt(e.target.value || "0", 10))
              }
              placeholder="0"
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
              checked={isUpcoming}
              onCheckedChange={setIsUpcoming}
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
            {rituals.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {rituals.map((r) => (
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
            {offerings.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {offerings.map((o) => (
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

            {sevaDetails.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label className="text-sm font-medium">Added Sevas:</Label>
                {sevaDetails.map((seva) => (
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
              <BookOpen className="mr-2 h-4 w-4" />
              Add Aaradhane
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
