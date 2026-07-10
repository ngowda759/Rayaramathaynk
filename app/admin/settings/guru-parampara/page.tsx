"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, RotateCcw, Plus, Trash2, GripVertical } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Guru {
  id: string;
  number: string;
  name: string;
  kannada: string;
  description: string;
}

interface GuruParamparaData {
  heading: string;
  headingKannada: string;
  subheading: string;
  subheadingKannada: string;
  gurus: Guru[];
}

const COLLECTION = "settings";
const DOCUMENT = "guruParampara";

const defaultData: GuruParamparaData = {
  heading: "Guru Parampara",
  headingKannada: "ಗುರು ಪರಂಪರೆ",
  subheading: "The sacred lineage of Madhva tradition",
  subheadingKannada: "ಮಾಧ್ವ ಸಂಪ್ರದಾಯದ ಪವಿತ್ರ ವಂಶಾವಳಿ",
  gurus: [],
};

export default function GuruParamparaSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<GuruParamparaData>(defaultData);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const docRef = doc(db, COLLECTION, DOCUMENT);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setData({ ...defaultData, ...docSnap.data() } as GuruParamparaData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function saveData() {
    setSaving(true);
    try {
      const docRef = doc(db, COLLECTION, DOCUMENT);
      await setDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      toast.success("Guru Parampara saved successfully!");
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof GuruParamparaData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function updateGuru(id: string, field: keyof Guru, value: string) {
    setData((prev) => ({
      ...prev,
      gurus: prev.gurus.map((g) =>
        g.id === id ? { ...g, [field]: value } : g
      ),
    }));
  }

  function addGuru() {
    const newNumber = (data.gurus.length + 1).toString().padStart(2, '0');
    const newGuru: Guru = {
      id: Date.now().toString(),
      number: newNumber,
      name: "",
      kannada: "",
      description: "",
    };
    setData((prev) => ({ ...prev, gurus: [...prev.gurus, newGuru] }));
  }

  function removeGuru(id: string) {
    if (confirm("Are you sure you want to remove this guru?")) {
      setData((prev) => ({
        ...prev,
        gurus: prev.gurus.filter((g) => g.id !== id),
      }));
    }
  }

  function moveGuru(index: number, direction: 'up' | 'down') {
    const newGurus = [...data.gurus];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newGurus.length) return;
    [newGurus[index], newGurus[targetIndex]] = [newGurus[targetIndex], newGurus[index]];
    // Update numbers
    newGurus.forEach((g, i) => {
      g.number = (i + 1).toString().padStart(2, '0');
    });
    setData((prev) => ({ ...prev, gurus: newGurus }));
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
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
          title="Guru Parampara Settings"
          description="Configure the Guru Parampara page content."
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
          className="bg-orange-600 hover:bg-orange-700"
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
              placeholder="Guru Parampara"
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
              placeholder="ಗುರು ಪರಂಪರೆ"
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
              placeholder="The sacred lineage..."
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
              placeholder="ಮಾಧ್ವ ಸಂಪ್ರದಾಯದ..."
            />
          </div>
        </div>
      </div>

      {/* Gurus List */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-900">Gurus</h3>
          <Button onClick={addGuru} size="sm" className="bg-orange-600 hover:bg-orange-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Guru
          </Button>
        </div>

        <div className="space-y-4">
          {data.gurus.map((guru, index) => (
            <div key={guru.id} className="rounded-lg border p-4 bg-stone-50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-5 w-5 text-stone-400 cursor-move" />
                  <span className="text-sm font-semibold text-orange-600">
                    #{guru.number}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => moveGuru(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-stone-400 hover:text-stone-600 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveGuru(index, 'down')}
                    disabled={index === data.gurus.length - 1}
                    className="p-1 text-stone-400 hover:text-stone-600 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeGuru(guru.id)}
                    className="text-red-500 hover:text-red-700 ml-2"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Guru Name (English)
                  </label>
                  <Input
                    type="text"
                    value={guru.name}
                    onChange={(e) => updateGuru(guru.id, "name", e.target.value)}
                    placeholder="Guru Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Guru Name (Kannada)
                  </label>
                  <Input
                    type="text"
                    value={guru.kannada}
                    onChange={(e) => updateGuru(guru.id, "kannada", e.target.value)}
                    placeholder="ಗುರು ಹೆಸರು"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Description (English)
                  </label>
                  <Textarea
                    value={guru.description}
                    onChange={(e) => updateGuru(guru.id, "description", e.target.value)}
                    placeholder="Description of the guru..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {data.gurus.length === 0 && (
          <div className="text-center py-8 text-stone-500">
            No gurus added yet. Click "Add Guru" to create one.
          </div>
        )}
      </div>

      <div className="flex justify-end pb-6">
        <Button
          onClick={saveData}
          disabled={saving}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
