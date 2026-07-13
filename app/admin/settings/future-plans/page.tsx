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

interface FuturePlan {
  id: string;
  title: string;
  titleKannada: string;
  description: string;
  descriptionKannada: string;
  icon: string;
  isActive: boolean;
  order: number;
}

interface FuturePlansData {
  heading: string;
  headingKannada: string;
  subheading: string;
  subheadingKannada: string;
  plans: FuturePlan[];
}

const COLLECTION = "settings";
const DOCUMENT = "futurePlans";

const iconOptions = [
  { value: "building", label: "Building" },
  { value: "book", label: "Book" },
  { value: "heart", label: "Heart" },
  { value: "graduation", label: "Graduation" },
  { value: "music", label: "Music" },
];

const defaultData: FuturePlansData = {
  heading: "Future Plans",
  headingKannada: "ಟ್ರಸ್ಟ್ ನ ಮುಂದಿನ ಮಹತ್ವಾಕಾಂಕ್ಷಿ ಯೋಜನೆಗಳು",
  subheading: "Join us in our journey to preserve and propagate the sacred traditions",
  subheadingKannada: "ನಮ್ಮ ಯಾತ್ರೆಯಲ್ಲಿ ಭಾಗಿಯಾಗಿ ಪವಿತ್ರ ಸಂಪ್ರದಾಯಗಳನ್ನು ಸಂರಕ್ಷಿಸಲು ಮತ್ತು ಪ್ರಸರಣ ಮಾಡಲು ನಮಗೆ ಸಹಾಯ ಮಾಡಿ",
  plans: [
    {
      id: "1",
      title: "Modern Building Project",
      titleKannada: "ಅತ್ಯಾಧುನಿಕ ಕಟ್ಟಡ ಯೋಜನೆ",
      description: "Plans to construct a modern 4-story building for the Matha with ample parking, meditation hall, modern kitchen, and a spacious hall that can accommodate at least 450 people. The building will have lifts and other modern amenities. Devotees can participate in this grand project.",
      descriptionKannada: "ಶ್ರೀ ಮಠದ ಮುಂದಿನ ದಿನಗಳಲ್ಲಿ 4 ಮಹಡಿಗಳ ಅತ್ಯಾಧುನಿಕ ಕಟ್ಟಡವನ್ನು ಗುರುರಾಜರಿಗೆ ಸಮರ್ಪಿಸಲು ಸಂಕಲ್ಪಿಸಲಾಗಿದೆ. ಕಟ್ಟಡವು ಆಧುನಿಕ ಪಾರ್ಕಿಂಗ್ ವ್ಯವಸ್ಥೆ, ಧ್ಯಾನ – ಪ್ರವಚನ ಮಂದಿರ, ಆಧುನಿಕ ಅಡಿಗೆ ಮನೆ, ಒಂದು ಮಹಡಿಯಲ್ಲಿ ಕನಿಷ್ಠ 450 ಕುಳಿತುಕೊಳ್ಳಲು ಅನುಕೂಲವಾಗುವಂತೆ ವಿಶಾಲ ಹಾಲ್. ಭಕ್ತರಿಗೆ ಎಲ್ಲಾ ಶುಭ ಕಾರ್ಯಕ್ರಮಗಳನ್ನು ಆಯೋಜಿಸಲು ಅನುಕೂಲವಾಗುವಂತೆ 2 ಸಣ್ಣ ಹಾಲ್. ಕಟ್ಟಡಕ್ಕೆ ಲಿಫ್ಟ್ ಸೌಲಭ್ಯ ಹಾಗೂ ಇನ್ನಿತರ ಆದುನಿಕ ಸೌಲಭ್ಯಗಳನ್ನು ಹೊಂದಿರುತ್ತದೆ. ಈ ಬೃಹತ್ ಯೋಜನೆಯಲ್ಲಿ ನೀವೂ ನಿಮ್ಮ ಯಥಾ ಶಕ್ತಿ ಪಾಲ್ಗೊಳ್ಳಬಹುದು.",
      icon: "building",
      isActive: true,
      order: 1,
    },
    {
      id: "2",
      title: "Knowledge Dissemination Project",
      titleKannada: "ಜ್ಞಾನ ಪ್ರಸಾರ ಯೋಜನೆ",
      description: "Annual knowledge dissemination activities including Madhvacharya philosophy propagation, Purana discussions, and lectures are planned throughout the year. A special endowment fund will be established for this purpose. You can participate in this project by offering a lecture service as your service.",
      descriptionKannada: "ಶ್ರೀ ಮಠದಲ್ಲಿ ವರ್ಷಪೂರ್ತಿ ಜ್ಞಾನ ಪ್ರಸಾರ ಕಾರ್ಯಗಳು, ಮಧ್ವಾಚಾರ್ಯರ ಸಿದ್ಧಾಂತ ಪ್ರಸಾರ, ಪುರಾಣಗಳು, ಉಪನ್ಯಾಸಗಳನ್ನು ವರ್ಷಪೂರ್ತಿ ನಡೆಸಲು ಆಯೋಜಿಸಲಾಗಿದೆ. ಈ ಕಾರ್ಯಕ್ಕೆ ಅನುಕೂಲವಾಗುವಂತೆ ವಿಶೇಷ ದತ್ತಿ ನಿಧಿಯನ್ನು ಸ್ಥಾಪಿಸಲು ಯೋಜಿಸಲಾಗಿದೆ. ಈ ಯೋಜನೆಯಲ್ಲಿ ತಾವೂ ಪಾಲ್ಗೊಳ್ಳಬಹುದು. ಈ ಯೋಜನೆಯಲ್ಲಿ ಒಂದು ಉಪನ್ಯಾಸದ ಸೇವೆಯನ್ನು ತಮ್ಮ ಸೇವೆಯಲ್ಲಿ ನಡೆಸಬಹುದು.",
      icon: "book",
      isActive: true,
      order: 2,
    },
    {
      id: "3",
      title: "Gomata Protection Project",
      titleKannada: "ಗೋ ಸಂರಕ್ಷಣಾ ಯೋಜನೆ",
      description: "Protection of cows is our primary duty. We already maintain a Goshaala with the best breed of cows from Malenadu. We plan to continue Gomata service on a larger scale in the future.",
      descriptionKannada: "ಗೋವಿನ ಸಂರಕ್ಷಣೆಯು ನಮ್ಮ ಆದ್ಯ ಕರ್ತವ್ಯದಲ್ಲಿ ಒಂದಾಗಿದೆ. ವಿಶೇಷವಾಗಿ ಮಲೆನಾಡಿನ ಅತ್ಯುತ್ತಮ ತಳಿಗಳ ಗೋವುಗಳನ್ನು ಸಂರಕ್ಷಿಸುವುದು, ಗೋವಿನ ಸೇವೆಗೆ, ಈಗಾಗಲೇ ನಮ್ಮದೇ ಆದ ಗೋಶಾಲೆ ನಡೆಸುತ್ತಿದ್ದೇವೆ. ಮುಂದಿನ ದಿನಗಳಲ್ಲಿ ಇನ್ನೂ ದೊಡ್ಡ ಮಟ್ಟದಲ್ಲಿ ಗೋಸೇವೆ ಮುಂದುವರಿಸಲು ಸಂಕಲ್ಪಿಸಲಾಗಿದೆ.",
      icon: "heart",
      isActive: true,
      order: 3,
    },
    {
      id: "4",
      title: "Vedic Education",
      titleKannada: "ವೈದಿಕ ಶಿಕ್ಷಣ",
      description: "Vedas will be prepared for teaching Vedic education, mantras, sukthas, deity worship methods to children and elders at the Matha. Mantra Stotra classes have already started and other classes will be started soon. Everyone can avail these facilities free of cost.",
      descriptionKannada: "ಶ್ರೀ ಮಠದಲ್ಲಿ ಮಕ್ಕಳಿಗೆ ಹಾಗೂ ಹಿರಿಯರಿಗೆ ವೈದಿಕ ಶಿಕ್ಷಣ, ಶ್ಲೋಕಗಳು, ಮಂತ್ರಗಳು, ಸೂಕ್ತಗಳು, ದೇವತಾ ಪೂಜಾ ವಿಧಾನಗಳು ಕಲಿಸಲು ವೇದಿಕೆಯನ್ನು ಸಿದ್ಧಪಡಿಸಲಾಗಿದೆ. ಮಂತ್ರ ಸ್ತೋತ್ರ ತರಗತಿಗಳು ಈಗಾಗಲೇ ಪ್ರಾರಂಭಾಗಿದ್ದು ಇತರ ತರಗತಿಗಳನ್ನು ಸದ್ಯದಲ್ಲೇ ಪ್ರಾರಂಭಿಸಲು ಯೋಜಿಸಲಾಗಿದೆ. ಎಲ್ಲಾರೂ ಈ ಸೌಲಭ್ಯಗಳನ್ನು ಉಚಿತವಾಗಿ ಪಡೆದುಕೊಳ್ಳಬಹುದು.",
      icon: "graduation",
      isActive: true,
      order: 4,
    },
    {
      id: "5",
      title: "Cultural Education",
      titleKannada: "ಸಾಂಸ್ಕೃತಿಕ ಶಿಕ್ಷಣ",
      description: "Committed to transform the Matha into a social and cultural center of faith, music, Bharatanatyam, Talavadya and other arts will be taught here.",
      descriptionKannada: "ಶ್ರೀ ಮಠವನ್ನು ಸಾಮಾಜಿಕ ಹಾಗೂ ಸಾಂಸ್ಕೃತಿಕ ಶ್ರದ್ದಾ ಕೇಂದ್ರವಾಗಿ ಮಾರ್ಪಡಿಸಲು ಕಟಿಬದ್ಧವಾಗಿದೆ, ಈ ಯೋಜನೆಯಲ್ಲಿ ಸಂಗೀತ, ಭರತನಾಟ್ಯ, ತಾಳವಾದ್ಯ ಮೊದಲಾದ ಕಲೆಗಳನ್ನು ಹೇಳಿಕೊಡಲಾಗುವುದು.",
      icon: "music",
      isActive: true,
      order: 5,
    },
  ],
};

export default function FuturePlansSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<FuturePlansData>(defaultData);

  useEffect(() => {
    async function loadData() {
        if (!db) {
          // Use default data when Firebase is not configured
          setLoading(false);
          return;
        }
      try {
        const docRef = doc(db, COLLECTION, DOCUMENT);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          // Merge with defaults to ensure all fields are present
          const firebaseData = docSnap.data();
          setData({
            ...defaultData,
            ...firebaseData,
            plans: firebaseData.plans && firebaseData.plans.length > 0 
              ? firebaseData.plans 
              : defaultData.plans,
          } as FuturePlansData);
        } else {
          // No data in Firebase - use defaults
          setData(defaultData);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load settings");
        // Fall back to defaults on error
        setData(defaultData);
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

      toast.success("Future Plans saved successfully!");
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof FuturePlansData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function updatePlan(id: string, field: keyof FuturePlan, value: unknown) {
    setData((prev) => ({
      ...prev,
      plans: prev.plans.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      ),
    }));
  }

  function addPlan() {
    const newPlan: FuturePlan = {
      id: Date.now().toString(),
      title: "",
      titleKannada: "",
      description: "",
      descriptionKannada: "",
      icon: "building",
      isActive: true,
      order: data.plans.length + 1,
    };
    setData((prev) => ({ ...prev, plans: [...prev.plans, newPlan] }));
  }

  function removePlan(id: string) {
    if (confirm("Are you sure you want to remove this plan?")) {
      setData((prev) => ({
        ...prev,
        plans: prev.plans.filter((p) => p.id !== id),
      }));
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
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
          title="Future Plans Settings"
          description="Configure the Future Plans page content."
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
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Main Heading */}
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
              placeholder="Future Plans"
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
              placeholder="ಟ್ರಸ್ಟ್ ನ ಮುಂದಿನ ಯೋಜನೆಗಳು"
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
              placeholder="Join us..."
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
              placeholder="ನಮ್ಮ ಯಾತ್ರೆಯಲ್ಲಿ..."
            />
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-900">Plans</h3>
          <Button onClick={addPlan} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Plan
          </Button>
        </div>

        <div className="space-y-6">
          {data.plans.map((plan, index) => (
            <div key={plan.id} className="rounded-lg border p-4 bg-stone-50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-stone-500">Plan #{index + 1}</span>
                <button
                  onClick={() => removePlan(plan.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Icon
                  </label>
                  <select
                    value={plan.icon}
                    onChange={(e) => updatePlan(plan.id, "icon", e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  >
                    {iconOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={plan.isActive}
                      onChange={(e) => updatePlan(plan.id, "isActive", e.target.checked)}
                      className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm font-medium text-stone-600">Active</span>
                  </label>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Order
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={plan.order}
                      onChange={(e) => updatePlan(plan.id, "order", parseInt(e.target.value) || 1)}
                      className="w-24"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Title (English)
                  </label>
                  <Input
                    type="text"
                    value={plan.title}
                    onChange={(e) => updatePlan(plan.id, "title", e.target.value)}
                    placeholder="Plan Title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Title (Kannada)
                  </label>
                  <Input
                    type="text"
                    value={plan.titleKannada}
                    onChange={(e) => updatePlan(plan.id, "titleKannada", e.target.value)}
                    placeholder="ಯೋಜನೆಯ ಶೀರ್ಷಿಕೆ"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Description (English)
                  </label>
                  <Textarea
                    value={plan.description}
                    onChange={(e) => updatePlan(plan.id, "description", e.target.value)}
                    placeholder="Description..."
                    rows={3}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Description (Kannada)
                  </label>
                  <Textarea
                    value={plan.descriptionKannada}
                    onChange={(e) => updatePlan(plan.id, "descriptionKannada", e.target.value)}
                    placeholder="ವಿವರಣೆ..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {data.plans.length === 0 && (
          <div className="text-center py-8 text-stone-500">
            No plans added yet. Click &quot;Add Plan&quot; to create one.
          </div>
        )}
      </div>

      <div className="flex justify-end pb-6">
        <Button
          onClick={saveData}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
