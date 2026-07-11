"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, RotateCcw, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { calendar } from "@/data/calendar";

interface EkadashiEntry {
  id: string;
  date: string;
  day: string;
}

interface EkadashiCalendarData {
  heading: string;
  headingKannada: string;
  samvatsara: string;
  samvatsaraKannada: string;
  entries: EkadashiEntry[];
}

const COLLECTION = "settings";
const DOCUMENT = "ekadashiCalendar";

// Load default data from static file
const defaultData: EkadashiCalendarData = {
  heading: "Ekadashi Schedule",
  headingKannada: "ಏಕಾದಶಿ ವೇಳಾಪಟ್ಟಿ",
  samvatsara: calendar.samvatsara,
  samvatsaraKannada: "ಶ್ರೀ ಪರಭವ ಸಂವತ್ಸರ",
  entries: calendar.ekadashi.map((e, i) => ({
    id: `entry-${i}`,
    date: e.date,
    day: e.day,
  })),
};

function getDayOfWeek(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "long" });
  } catch {
    return "";
  }
}

export default function EkadashiCalendarSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<EkadashiCalendarData>(defaultData);

  useEffect(() => {
    async function loadData() {
        if (!db) {
          setLoading(false);
          return;
        }
      try {
        const docRef = doc(db, COLLECTION, DOCUMENT);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setData({ ...defaultData, ...docSnap.data() } as EkadashiCalendarData);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function saveData() {
    if (!db) {
      toast.error("Firebase not configured");
      return;
    }
    setSaving(true);
    try {
      const docRef = doc(db, COLLECTION, DOCUMENT);
      await setDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      toast.success("Ekadashi Calendar saved successfully!");
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof EkadashiCalendarData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function addEntry() {
    const today = new Date();
    today.setDate(today.getDate() + 30); // Default to 30 days from now
    const dateStr = today.toISOString().split("T")[0];
    
    const newEntry: EkadashiEntry = {
      id: `entry-${Date.now()}`,
      date: dateStr,
      day: getDayOfWeek(dateStr),
    };
    setData((prev) => ({ ...prev, entries: [...prev.entries, newEntry] }));
  }

  function removeEntry(id: string) {
    if (confirm("Are you sure you want to remove this entry?")) {
      setData((prev) => ({
        ...prev,
        entries: prev.entries.filter((e) => e.id !== id),
      }));
    }
  }

  function updateEntry(id: string, field: keyof EkadashiEntry, value: string) {
    setData((prev) => ({
      ...prev,
      entries: prev.entries.map((e) =>
        e.id === id ? { 
          ...e, 
          [field]: value,
          day: field === "date" ? getDayOfWeek(value) : e.day
        } : e
      ),
    }));
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/settings"
          className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <AdminPageHeader
          title="Ekadashi Calendar Settings"
          description="Configure the Ekadashi calendar entries."
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => setData(defaultData)}
          className="border-stone-300"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button
          onClick={saveData}
          disabled={saving}
          className="bg-sky-600 hover:bg-sky-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Page Header */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Page Header</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Heading (English)
            </label>
            <Input
              type="text"
              value={data.heading}
              onChange={(e) => updateField("heading", e.target.value)}
              placeholder="Ekadashi Schedule"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Heading (Kannada)
            </label>
            <Input
              type="text"
              value={data.headingKannada}
              onChange={(e) => updateField("headingKannada", e.target.value)}
              placeholder="ಏಕಾದಶಿ ವೇಳಾಪಟ್ಟಿ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Samvatsara (Year Name - English)
            </label>
            <Input
              type="text"
              value={data.samvatsara}
              onChange={(e) => updateField("samvatsara", e.target.value)}
              placeholder="Sri Parabhava"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Samvatsara (Year Name - Kannada)
            </label>
            <Input
              type="text"
              value={data.samvatsaraKannada}
              onChange={(e) => updateField("samvatsaraKannada", e.target.value)}
              placeholder="ಶ್ರೀ ಪರಭವ ಸಂವತ್ಸರ"
            />
          </div>
        </div>
      </div>

      {/* Entries */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-900">Ekadashi Entries ({data.entries.length})</h3>
          <Button onClick={addEntry} size="sm" className="bg-sky-600 hover:bg-sky-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Entry
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-sky-50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700">#</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700">Day</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700">Observance</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700"></th>
              </tr>
            </thead>
            <tbody>
              {data.entries
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((entry, index) => (
                  <tr key={entry.id} className="border-t border-stone-100">
                    <td className="px-4 py-3 text-stone-500">{index + 1}</td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={entry.date}
                        onChange={(e) => updateEntry(entry.id, "date", e.target.value)}
                        className="rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                      />
                    </td>
                    <td className="px-4 py-3 text-stone-600">{entry.day}</td>
                    <td className="px-4 py-3 text-stone-600">Ekadashi</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {data.entries.length === 0 && (
          <div className="text-center py-8 text-stone-500">
            No entries added yet. Click &ldquo;Add Entry&rdquo; to create one.
          </div>
        )}
      </div>

      <div className="flex justify-end pb-6">
        <Button
          onClick={saveData}
          disabled={saving}
          className="bg-sky-600 hover:bg-sky-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
