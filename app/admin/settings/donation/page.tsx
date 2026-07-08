"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical, Save, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DonationPurpose, defaultDonationPurposes } from "@/types/donation";

const SETTINGS_DOC = "donationSettings";
const SETTINGS_COLLECTION = "settings";

export default function DonationSettingsPage() {
  const [purposes, setPurposes] = useState<DonationPurpose[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPurposes();
  }, []);

  async function loadPurposes() {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists() && docSnap.data().donationPurposes) {
        setPurposes(docSnap.data().donationPurposes);
      } else {
        setPurposes(defaultDonationPurposes);
      }
    } catch (error) {
      console.error("Error loading purposes:", error);
      setPurposes(defaultDonationPurposes);
    } finally {
      setLoading(false);
    }
  }

  async function savePurposes() {
    setSaving(true);
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
      await setDoc(docRef, {
        donationPurposes: purposes,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      
      toast.success("Donation settings saved successfully!");
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving purposes:", error);
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function updatePurpose(id: string, field: keyof DonationPurpose, value: unknown) {
    setPurposes(prev => 
      prev.map(p => p.id === id ? { ...p, [field]: value } : p)
    );
    setHasChanges(true);
  }

  function addPurpose() {
    const newPurpose: DonationPurpose = {
      id: Date.now().toString(),
      title: "",
      description: "",
      suggestedAmount: 100,
      icon: "heart",
      isActive: true,
      order: purposes.length + 1,
    };
    setPurposes(prev => [...prev, newPurpose]);
    setHasChanges(true);
  }

  function removePurpose(id: string) {
    setPurposes(prev => prev.filter(p => p.id !== id));
    setHasChanges(true);
  }

  function resetToDefaults() {
    if (confirm("Are you sure you want to reset to default purposes?")) {
      setPurposes(defaultDonationPurposes);
      setHasChanges(true);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Donation Settings</h1>
          <p className="mt-1 text-sm text-stone-600">
            Configure donation purposes shown on the donation page
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            onClick={savePurposes}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {purposes.map((purpose, index) => (
          <div
            key={purpose.id}
            className="rounded-xl border bg-white p-6 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="mt-7 cursor-move text-stone-400 hover:text-stone-600">
                <GripVertical className="h-5 w-5" />
              </div>
              
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                    #{index + 1}
                  </span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={purpose.isActive}
                      onChange={(e) => updatePurpose(purpose.id, "isActive", e.target.checked)}
                      className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm text-stone-600">Active</span>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={purpose.title}
                      onChange={(e) => updatePurpose(purpose.id, "title", e.target.value)}
                      placeholder="e.g., Annadanam"
                      className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Suggested Amount (₹)
                    </label>
                    <input
                      type="number"
                      value={purpose.suggestedAmount}
                      onChange={(e) => updatePurpose(purpose.id, "suggestedAmount", parseInt(e.target.value) || 0)}
                      placeholder="501"
                      className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={purpose.description}
                      onChange={(e) => updatePurpose(purpose.id, "description", e.target.value)}
                      placeholder="Description of this donation purpose..."
                      rows={2}
                      className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => removePurpose(purpose.id)}
                className="mt-6 text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addPurpose}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 py-4 text-stone-500 hover:border-amber-400 hover:text-amber-600"
        >
          <Plus className="h-5 w-5" />
          Add Donation Purpose
        </button>
      </div>

      <div className="rounded-xl border bg-blue-50 p-4">
        <h3 className="font-medium text-blue-900">How it works</h3>
        <p className="mt-1 text-sm text-blue-700">
          These donation purposes will appear on the public donation page as selectable options with suggested amounts. 
          Active purposes are shown, and they are displayed in the order shown here.
        </p>
      </div>
    </div>
  );
}
