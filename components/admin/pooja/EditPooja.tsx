"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { poojaService } from "@/services/pooja.service";
import { DailyPooja, PoojaCategory } from "@/types/pooja";

interface EditPoojaProps {
  poojaId: string;
}

export default function EditPooja({ poojaId }: EditPoojaProps) {
  const [pooja, setPooja] = useState<DailyPooja | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    startTime: "",
    duration: "",
    category: "",
    sevaAmount: "",
    isActive: false,
    notes: "",
  });

  const router = useRouter();

  useEffect(() => {
    async function loadPooja() {
      try {
        const data = await poojaService.getPoojaById(poojaId);
        if (data) {
           
          setPooja(data);
           
          setForm({
            title: data.title,
            description: data.description,
            startTime: data.startTime,
            duration: data.duration,
            category: data.category,
            sevaAmount: data.sevaAmount.toString(),
            isActive: data.isActive,
            notes: data.notes,
          });
        }
      } catch (error) {
        console.error("Failed to load pooja:", error);
      } finally {
         
        setLoading(false);
      }
    }

    loadPooja();
  }, [poojaId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await poojaService.updatePooja(poojaId, {
        title: form.title,
        description: form.description,
        startTime: form.startTime,
        duration: form.duration,
        category: form.category as PoojaCategory,
        sevaAmount: Number(form.sevaAmount),
        isActive: form.isActive,
        notes: form.notes,
      });
      router.push("/admin/pooja");
    } catch (error) {
      console.error("Failed to update pooja:", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-8 shadow-sm">
      {loading ? (
        <p className="text-stone-500">Loading pooja...</p>
      ) : pooja ? (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <Input
            label="Title"
            value={form.title}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, title: event.target.value }))
            }
          />

          <Textarea
            className="min-h-[120px]"
            placeholder="Description"
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Start Time"
              value={form.startTime}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, startTime: event.target.value }))
              }
            />
            <Input
              label="Duration"
              value={form.duration}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, duration: event.target.value }))
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Category"
              value={form.category}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, category: event.target.value }))
              }
            />
            <Input
              label="Seva Amount"
              type="number"
              value={form.sevaAmount}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, sevaAmount: event.target.value }))
              }
            />
          </div>

          <div className="flex items-center gap-4">
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, isActive: checked ?? false }))
              }
            />
            <Label>Active</Label>
          </div>

          <Textarea
            className="min-h-[120px]"
            placeholder="Notes"
            value={form.notes}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, notes: event.target.value }))
            }
          />

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center font-medium transition disabled:opacity-50 disabled:cursor-not-allowed bg-orange-600 hover:bg-orange-700 text-white h-11 rounded-lg px-4 py-3"
          >
            {saving ? "Saving..." : "Update Pooja"}
          </button>
        </form>
      ) : (
        <p className="text-red-600">Pooja not found.</p>
      )}
    </div>
  );
}
