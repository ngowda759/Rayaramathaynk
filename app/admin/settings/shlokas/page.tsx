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
import { shlokas as shlokasData } from "@/data/shlokas";

interface Shloka {
  id: string;
  title: string;
  titleKannada: string;
  author?: string;
  authorKannada?: string;
  category: string;
  verses: string[];
  meaning?: string;
}

interface ShlokasData {
  heading: string;
  headingKannada: string;
  subheading: string;
  subheadingKannada: string;
  shlokas: Shloka[];
  categories: string[];
}

const COLLECTION = "settings";
const DOCUMENT = "shlokas";

// Load default data from static file
const defaultData: ShlokasData = {
  heading: "Shlokas & Stotrams",
  headingKannada: "ಶ್ಲೋಕಗಳು",
  subheading: "Sacred hymns and prayers for daily worship",
  subheadingKannada: "ದೈನಿಕ ಆರಾಧನೆಗಾಗಿ ಪವಿತ್ರ ಜಪ ಮತ್ತು ಪ್ರಾರ್ಥನೆಗಳು",
  shlokas: shlokasData,
  categories: ["All", "Daily Prayers", "Sri Raghavendra Swamy", "Venkateswara", "Vishnu", "Hanuman", "Shiva", "Ganesha", "Lakshmi", "Durga"],
};

export default function ShlokasSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ShlokasData>(defaultData);

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
          setData({ ...defaultData, ...docSnap.data() } as ShlokasData);
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

      toast.success("Shlokas saved successfully!");
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof ShlokasData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function updateShloka(id: string, field: keyof Shloka, value: string | string[]) {
    setData((prev) => ({
      ...prev,
      shlokas: prev.shlokas.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    }));
  }

  function addShloka() {
    const newShloka: Shloka = {
      id: `shloka-${Date.now()}`,
      title: "",
      titleKannada: "",
      category: "Daily Prayers",
      verses: [""],
      meaning: "",
    };
    setData((prev) => ({ ...prev, shlokas: [...prev.shlokas, newShloka] }));
  }

  function removeShloka(id: string) {
    if (confirm("Are you sure you want to remove this shloka?")) {
      setData((prev) => ({
        ...prev,
        shlokas: prev.shlokas.filter((s) => s.id !== id),
      }));
    }
  }

  function updateVerse(shlokaId: string, index: number, value: string) {
    const shloka = data.shlokas.find((s) => s.id === shlokaId);
    if (!shloka) return;
    const newVerses = [...shloka.verses];
    newVerses[index] = value;
    updateShloka(shlokaId, "verses", newVerses);
  }

  function addVerse(shlokaId: string) {
    const shloka = data.shlokas.find((s) => s.id === shlokaId);
    if (!shloka) return;
    updateShloka(shlokaId, "verses", [...shloka.verses, ""]);
  }

  function removeVerse(shlokaId: string, index: number) {
    const shloka = data.shlokas.find((s) => s.id === shlokaId);
    if (!shloka || shloka.verses.length <= 1) return;
    const newVerses = shloka.verses.filter((_, i) => i !== index);
    updateShloka(shlokaId, "verses", newVerses);
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
          title="Shlokas Settings"
          description="Configure the Shlokas page content."
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
              placeholder="Shlokas & Stotrams"
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
              placeholder="ಶ್ಲೋಕಗಳು"
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
              placeholder="Sacred hymns..."
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
              placeholder="ಪವಿತ್ರ ಜಪ..."
            />
          </div>
        </div>
      </div>

      {/* Shlokas List */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-900">Shlokas ({data.shlokas.length})</h3>
          <Button onClick={addShloka} size="sm" className="bg-amber-600 hover:bg-amber-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Shloka
          </Button>
        </div>

        <div className="space-y-6">
          {data.shlokas.map((shloka, index) => (
            <div key={shloka.id} className="rounded-lg border p-4 bg-stone-50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-amber-600">Shloka #{index + 1}</span>
                <button
                  onClick={() => removeShloka(shloka.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Title (English)
                  </label>
                  <Input
                    type="text"
                    value={shloka.title}
                    onChange={(e) => updateShloka(shloka.id, "title", e.target.value)}
                    placeholder="Shloka Title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Title (Kannada)
                  </label>
                  <Input
                    type="text"
                    value={shloka.titleKannada}
                    onChange={(e) => updateShloka(shloka.id, "titleKannada", e.target.value)}
                    placeholder="ಶ್ಲೋಕ ಶೀರ್ಷಿಕೆ"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Category
                  </label>
                  <select
                    value={shloka.category}
                    onChange={(e) => updateShloka(shloka.id, "category", e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  >
                    {data.categories.filter(c => c !== "All").map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Author (English)
                  </label>
                  <Input
                    type="text"
                    value={shloka.author || ""}
                    onChange={(e) => updateShloka(shloka.id, "author", e.target.value)}
                    placeholder="Author name (optional)"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Meaning (English)
                  </label>
                  <Textarea
                    value={shloka.meaning || ""}
                    onChange={(e) => updateShloka(shloka.id, "meaning", e.target.value)}
                    placeholder="Meaning of the shloka..."
                    rows={2}
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-stone-700">
                      Verses (Kannada)
                    </label>
                    <Button onClick={() => addVerse(shloka.id)} size="sm" variant="outline">
                      <Plus className="mr-1 h-3 w-3" />
                      Add Verse
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {shloka.verses.map((verse, verseIndex) => (
                      <div key={verseIndex} className="flex gap-2">
                        <span className="text-stone-400 pt-2 w-6">{verseIndex + 1}.</span>
                        <Input
                          type="text"
                          value={verse}
                          onChange={(e) => updateVerse(shloka.id, verseIndex, e.target.value)}
                          placeholder="ಕನ್ನಡ ಪದ್ಯ..."
                        />
                        <button
                          onClick={() => removeVerse(shloka.id, verseIndex)}
                          disabled={shloka.verses.length <= 1}
                          className="text-red-500 hover:text-red-700 p-2 disabled:opacity-30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {data.shlokas.length === 0 && (
          <div className="text-center py-8 text-stone-500">
            No shlokas added yet. Click &quot;Add Shloka&quot; to create one.
          </div>
        )}
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
