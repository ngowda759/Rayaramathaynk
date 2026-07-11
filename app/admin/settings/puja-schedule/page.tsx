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
import { Textarea } from "@/components/ui/textarea";

interface PoojaScheduleData {
  heading: string;
  headingKannada: string;
  subheading: string;
  subheadingKannada: string;
  
  // Morning Schedule
  morningTitle: string;
  morningOpen: string;
  morningClose: string;
  morningSchedule: string[];
  
  // Evening Schedule
  eveningTitle: string;
  eveningOpen: string;
  eveningClose: string;
  eveningSchedule: string[];
  
  // Festival Note
  festivalNote: string;
  festivalNoteKannada: string;
  
  // Temple Status
  isTempleOpen: boolean;
}

const COLLECTION = "settings";
const DOCUMENT = "poojaSchedule";

const defaultData: PoojaScheduleData = {
  heading: "Daily Pooja Schedule",
  headingKannada: "ದೈನಿಕ ಪೂಜಾ ವೇಳಾಪಟ್ಟಿ",
  subheading: "Find the temple's daily rituals, timings, and offerings.",
  subheadingKannada: "ದೇವಸ್ಥಾನದ ದೈನಿಕ ದೀಕ್ಷೆ, ಸಮಯ ಮತ್ತು ಕಾಣಿಕೆಗಳನ್ನು ಹುಡುಕಿ.",
  
  morningTitle: "Morning Darshan",
  morningOpen: "06:00 AM",
  morningClose: "01:00 PM",
  morningSchedule: [
    "Suprabhata Seva",
    "Alankara",
    "Darshan",
    "Theertha & Prasada",
  ],
  
  eveningTitle: "Evening Darshan",
  eveningOpen: "04:30 PM",
  eveningClose: "08:30 PM",
  eveningSchedule: [
    "Evening Pooja",
    "Mangalarati",
    "Darshan",
    "Temple Closing",
  ],
  
  festivalNote: "Temple timings may be extended during festivals, Raghavendra Swamygala Aaradhane, Navaratri and other special occasions.",
  festivalNoteKannada: "ಉತ್ಸವಗಳು, ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಗಳ ಆರಾಧನೆ, ನವರಾತ್ರಿ ಮತ್ತು ಇತರ ವಿಶೇಷ ಸಂದರ್ಭಗಳಲ್ಲಿ ದೇವಸ್ಥಾನದ ಸಮಯವನ್ನು ವಿಸ್ತರಿಸಬಹುದು.",
  
  isTempleOpen: true,
};

export default function PoojaScheduleSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<PoojaScheduleData>(defaultData);

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
          setData({ ...defaultData, ...docSnap.data() } as PoojaScheduleData);
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

      toast.success("Pooja Schedule saved successfully!");
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof PoojaScheduleData, value: string | boolean) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function updateMorningItem(index: number, value: string) {
    const newItems = [...data.morningSchedule];
    newItems[index] = value;
    setData((prev) => ({ ...prev, morningSchedule: newItems }));
  }

  function addMorningItem() {
    setData((prev) => ({
      ...prev,
      morningSchedule: [...prev.morningSchedule, ""],
    }));
  }

  function removeMorningItem(index: number) {
    setData((prev) => ({
      ...prev,
      morningSchedule: prev.morningSchedule.filter((_, i) => i !== index),
    }));
  }

  function updateEveningItem(index: number, value: string) {
    const newItems = [...data.eveningSchedule];
    newItems[index] = value;
    setData((prev) => ({ ...prev, eveningSchedule: newItems }));
  }

  function addEveningItem() {
    setData((prev) => ({
      ...prev,
      eveningSchedule: [...prev.eveningSchedule, ""],
    }));
  }

  function removeEveningItem(index: number) {
    setData((prev) => ({
      ...prev,
      eveningSchedule: prev.eveningSchedule.filter((_, i) => i !== index),
    }));
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
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
          title="Pooja Schedule Settings"
          description="Configure the daily pooja schedule and temple timings."
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
          className="bg-amber-600 hover:bg-amber-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Temple Status */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Temple Status</h3>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={data.isTempleOpen}
            onChange={(e) => updateField("isTempleOpen", e.target.checked)}
            className="h-5 w-5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
          />
          <span className="text-sm font-medium text-stone-700">
            Temple is currently open for darshan
          </span>
        </label>
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
              placeholder="Daily Pooja Schedule"
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
              placeholder="ದೈನಿಕ ಪೂಜಾ ವೇಳಾಪಟ್ಟಿ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Subheading (English)
            </label>
            <Input
              type="text"
              value={data.subheading}
              onChange={(e) => updateField("subheading", e.target.value)}
              placeholder="Find the temple's daily rituals..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Subheading (Kannada)
            </label>
            <Input
              type="text"
              value={data.subheadingKannada}
              onChange={(e) => updateField("subheadingKannada", e.target.value)}
              placeholder="ದೇವಸ್ಥಾನದ ದೈನಿಕ ದೀಕ್ಷೆ..."
            />
          </div>
        </div>
      </div>

      {/* Morning Schedule */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Morning Schedule</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Title
            </label>
            <Input
              type="text"
              value={data.morningTitle}
              onChange={(e) => updateField("morningTitle", e.target.value)}
              placeholder="Morning Darshan"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Open Time
            </label>
            <Input
              type="text"
              value={data.morningOpen}
              onChange={(e) => updateField("morningOpen", e.target.value)}
              placeholder="06:00 AM"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Close Time
            </label>
            <Input
              type="text"
              value={data.morningClose}
              onChange={(e) => updateField("morningClose", e.target.value)}
              placeholder="01:00 PM"
            />
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-stone-700">
              Schedule Items
            </label>
            <Button onClick={addMorningItem} size="sm" variant="outline">
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {data.morningSchedule.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="text"
                  value={item}
                  onChange={(e) => updateMorningItem(index, e.target.value)}
                  placeholder="Schedule item"
                />
                <button
                  onClick={() => removeMorningItem(index)}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Evening Schedule */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Evening Schedule</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Title
            </label>
            <Input
              type="text"
              value={data.eveningTitle}
              onChange={(e) => updateField("eveningTitle", e.target.value)}
              placeholder="Evening Darshan"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Open Time
            </label>
            <Input
              type="text"
              value={data.eveningOpen}
              onChange={(e) => updateField("eveningOpen", e.target.value)}
              placeholder="04:30 PM"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Close Time
            </label>
            <Input
              type="text"
              value={data.eveningClose}
              onChange={(e) => updateField("eveningClose", e.target.value)}
              placeholder="08:30 PM"
            />
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-stone-700">
              Schedule Items
            </label>
            <Button onClick={addEveningItem} size="sm" variant="outline">
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {data.eveningSchedule.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="text"
                  value={item}
                  onChange={(e) => updateEveningItem(index, e.target.value)}
                  placeholder="Schedule item"
                />
                <button
                  onClick={() => removeEveningItem(index)}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Festival Note */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Festival Schedule Note</h3>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Note (English)
            </label>
            <Textarea
              value={data.festivalNote}
              onChange={(e) => updateField("festivalNote", e.target.value)}
              placeholder="Temple timings may be extended during festivals..."
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Note (Kannada)
            </label>
            <Textarea
              value={data.festivalNoteKannada}
              onChange={(e) => updateField("festivalNoteKannada", e.target.value)}
              placeholder="ಉತ್ಸವಗಳಲ್ಲಿ ದೇವಸ್ಥಾನದ ಸಮಯವನ್ನು..."
              rows={2}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pb-6">
        <Button
          onClick={saveData}
          disabled={saving}
          className="bg-amber-600 hover:bg-amber-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
