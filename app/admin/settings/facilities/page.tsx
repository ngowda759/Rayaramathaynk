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

interface Facility {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
}

interface Amenity {
  id: string;
  title: string;
}

interface FacilitiesData {
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  pageTitle: string;
  pageSubtitle: string;
  sectionTitle: string;
  sectionSubtitle: string;
  facilities: Facility[];
  amenitiesTitle: string;
  amenitiesSubtitle: string;
  amenities: Amenity[];
}

const COLLECTION = "settings";
const DOCUMENT = "facilities";

const iconOptions = [
  { value: "Flame", label: "Flame" },
  { value: "Building2", label: "Building" },
  { value: "Users", label: "Users" },
  { value: "UtensilsCrossed", label: "Food" },
  { value: "Volume2", label: "Sound" },
  { value: "Sparkles", label: "Sparkles" },
];

const colorOptions = [
  { value: "from-orange-500 to-amber-500", label: "Orange/Amber" },
  { value: "from-blue-500 to-cyan-500", label: "Blue/Cyan" },
  { value: "from-green-500 to-emerald-500", label: "Green/Emerald" },
  { value: "from-amber-500 to-yellow-500", label: "Amber/Yellow" },
  { value: "from-purple-500 to-pink-500", label: "Purple/Pink" },
  { value: "from-rose-500 to-red-500", label: "Rose/Red" },
  { value: "from-teal-500 to-cyan-500", label: "Teal/Cyan" },
  { value: "from-indigo-500 to-purple-500", label: "Indigo/Purple" },
];

const defaultData: FacilitiesData = {
  heroTitle: "Matha Facilities",
  heroSubtitle: "Sri Matha is dedicated to providing a sacred, serene, and well-equipped environment for all devotees. With a blend of traditional values and modern amenities, we ensure every seva, homa, and Pitrukarya is performed with devotion, comfort, and authenticity.",
  heroImageUrl: "/images/Hero.jpg",
  pageTitle: "Our Facilities",
  pageSubtitle: "Everything you need for a meaningful spiritual experience",
  sectionTitle: "Visit Us Today",
  sectionSubtitle: "Experience the divine ambience, participate in regular poojas, and join our temple community events.",
  facilities: [
    {
      id: "1",
      icon: "Flame",
      title: "Homa & Seva Facilities",
      description: "Sri Matha is fully equipped to perform all kinds of Homas, Pitrukaryas, and Sevas according to Vedic traditions. We have in-house experienced Purohitas who are available to guide and conduct rituals with complete devotion and adherence to Shastra.",
      color: "from-orange-500 to-amber-500",
    },
    {
      id: "2",
      icon: "Building2",
      title: "Spacious Halls",
      description: "We offer a range of halls to accommodate various spiritual and family events: 1 Large Hall (up to 200 people) and 4 Small Halls (50-100 people each).",
      color: "from-blue-500 to-cyan-500",
    },
    {
      id: "3",
      icon: "Users",
      title: "Theertha Prasada Hall",
      description: "Our Theertha Prasada section can accommodate up to 500 devotees at a time, ensuring smooth and comfortable prasada distribution during festivals, special sevas, and daily offerings.",
      color: "from-green-500 to-emerald-500",
    },
    {
      id: "4",
      icon: "UtensilsCrossed",
      title: "Pure & Traditional Food Preparation",
      description: "At Sri Matha, we uphold the highest traditions of purity. Food is prepared entirely using wood fire, followed strictly for Madi Naivedya and Theertha Prasada.",
      color: "from-amber-500 to-yellow-500",
    },
    {
      id: "5",
      icon: "Volume2",
      title: "Modern Amenities",
      description: "Modern Public Announcement (Sound) System for clear communication during pujas and events. Clean and well-maintained toilets with Western-style commodes for elders.",
      color: "from-purple-500 to-pink-500",
    },
    {
      id: "6",
      icon: "Sparkles",
      title: "Devotion, Tradition & Convenience",
      description: "Sri Matha is dedicated to providing a sacred, serene, and well-equipped environment for all devotees. With a blend of traditional values and modern amenities.",
      color: "from-rose-500 to-red-500",
    },
  ],
  amenitiesTitle: "Additional Amenities",
  amenitiesSubtitle: "We strive to make every visit comfortable and convenient for all devotees, regardless of age or ability.",
  amenities: [
    { id: "1", title: "Wheelchair accessible premises" },
    { id: "2", title: "Dedicated parking space" },
    { id: "3", title: "Pure vegetarian kitchen" },
    { id: "4", title: "Wood-fired cooking" },
    { id: "5", title: "Madi-maintained facilities" },
    { id: "6", title: "Clean drinking water" },
    { id: "7", title: "First aid facility" },
    { id: "8", title: "Dedicated Purohit services" },
  ],
};

export default function FacilitiesSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<FacilitiesData>(defaultData);

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
          setData({ ...defaultData, ...docSnap.data() } as FacilitiesData);
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

      toast.success("Facilities saved successfully!");
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof FacilitiesData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function updateFacility(id: string, field: keyof Facility, value: string) {
    setData((prev) => ({
      ...prev,
      facilities: prev.facilities.map((f) =>
        f.id === id ? { ...f, [field]: value } : f
      ),
    }));
  }

  function addFacility() {
    const newFacility: Facility = {
      id: Date.now().toString(),
      icon: "Flame",
      title: "",
      description: "",
      color: "from-orange-500 to-amber-500",
    };
    setData((prev) => ({ ...prev, facilities: [...prev.facilities, newFacility] }));
  }

  function removeFacility(id: string) {
    if (confirm("Are you sure you want to remove this facility?")) {
      setData((prev) => ({
        ...prev,
        facilities: prev.facilities.filter((f) => f.id !== id),
      }));
    }
  }

  function updateAmenity(id: string, title: string) {
    setData((prev) => ({
      ...prev,
      amenities: prev.amenities.map((a) =>
        a.id === id ? { ...a, title } : a
      ),
    }));
  }

  function addAmenity() {
    const newAmenity: Amenity = {
      id: Date.now().toString(),
      title: "",
    };
    setData((prev) => ({ ...prev, amenities: [...prev.amenities, newAmenity] }));
  }

  function removeAmenity(id: string) {
    if (confirm("Are you sure you want to remove this amenity?")) {
      setData((prev) => ({
        ...prev,
        amenities: prev.amenities.filter((a) => a.id !== id),
      }));
    }
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
          title="Facilities Settings"
          description="Configure the Facilities page content."
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

      {/* Hero Section */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Hero Section</h3>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Hero Title
            </label>
            <Input
              type="text"
              value={data.heroTitle}
              onChange={(e) => updateField("heroTitle", e.target.value)}
              placeholder="Matha Facilities"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Hero Subtitle
            </label>
            <Textarea
              value={data.heroSubtitle}
              onChange={(e) => updateField("heroSubtitle", e.target.value)}
              placeholder="Hero subtitle..."
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Hero Image URL
            </label>
            <Input
              type="text"
              value={data.heroImageUrl}
              onChange={(e) => updateField("heroImageUrl", e.target.value)}
              placeholder="/images/Hero.jpg"
            />
            <p className="text-xs text-stone-500 mt-1">Leave empty to hide hero image</p>
          </div>
        </div>
      </div>

      {/* Page Settings Section */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Page Title Settings</h3>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Section Title
            </label>
            <Input
              type="text"
              value={data.pageTitle}
              onChange={(e) => updateField("pageTitle", e.target.value)}
              placeholder="Our Facilities"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Section Subtitle
            </label>
            <Input
              type="text"
              value={data.pageSubtitle}
              onChange={(e) => updateField("pageSubtitle", e.target.value)}
              placeholder="Everything you need..."
            />
          </div>
        </div>
      </div>

      {/* Facilities Section */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Facilities</h3>
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-stone-700">
              Facility Cards
            </label>
            <Button onClick={addFacility} size="sm" variant="outline">
              <Plus className="mr-1 h-3 w-3" />
              Add Facility
            </Button>
          </div>
          <div className="space-y-6">
            {data.facilities.map((facility, index) => (
              <div key={facility.id} className="rounded-lg border p-4 bg-stone-50">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-stone-600">Facility #{index + 1}</span>
                  <button
                    onClick={() => removeFacility(facility.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Icon</label>
                    <select
                      value={facility.icon}
                      onChange={(e) => updateFacility(facility.id, "icon", e.target.value)}
                      className="w-full rounded-lg border border-stone-300 p-2 text-sm"
                    >
                      {iconOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Color</label>
                    <select
                      value={facility.color}
                      onChange={(e) => updateFacility(facility.id, "color", e.target.value)}
                      className="w-full rounded-lg border border-stone-300 p-2 text-sm"
                    >
                      {colorOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Title</label>
                    <Input
                      type="text"
                      value={facility.title}
                      onChange={(e) => updateFacility(facility.id, "title", e.target.value)}
                      placeholder="Facility title"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-stone-600 mb-1">Description</label>
                  <Textarea
                    value={facility.description}
                    onChange={(e) => updateFacility(facility.id, "description", e.target.value)}
                    placeholder="Facility description..."
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>
          {data.facilities.length === 0 && (
            <div className="text-center py-8 text-stone-500">
              No facilities added yet. Click &ldquo;Add Facility&rdquo; to create one.
            </div>
          )}
        </div>
      </div>

      {/* Additional Amenities Section */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Additional Amenities</h3>
        <div className="grid gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Section Title
            </label>
            <Input
              type="text"
              value={data.amenitiesTitle}
              onChange={(e) => updateField("amenitiesTitle", e.target.value)}
              placeholder="Additional Amenities"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Section Subtitle
            </label>
            <Textarea
              value={data.amenitiesSubtitle}
              onChange={(e) => updateField("amenitiesSubtitle", e.target.value)}
              placeholder="We strive to make every visit comfortable..."
              rows={2}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-stone-700">
              Amenity Items
            </label>
            <Button onClick={addAmenity} size="sm" variant="outline">
              <Plus className="mr-1 h-3 w-3" />
              Add Amenity
            </Button>
          </div>
          <div className="space-y-3">
            {data.amenities.map((amenity, index) => (
              <div key={amenity.id} className="flex gap-2">
                <Input
                  type="text"
                  value={amenity.title}
                  onChange={(e) => updateAmenity(amenity.id, e.target.value)}
                  placeholder="Amenity item"
                />
                <button
                  onClick={() => removeAmenity(amenity.id)}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {data.amenities.length === 0 && (
            <div className="text-center py-8 text-stone-500">
              No amenities added yet. Click &ldquo;Add Amenity&rdquo; to create one.
            </div>
          )}
        </div>
      </div>

      {/* CTA Section */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Call to Action Section</h3>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Section Title
            </label>
            <Input
              type="text"
              value={data.sectionTitle}
              onChange={(e) => updateField("sectionTitle", e.target.value)}
              placeholder="Visit Us Today"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Section Subtitle
            </label>
            <Textarea
              value={data.sectionSubtitle}
              onChange={(e) => updateField("sectionSubtitle", e.target.value)}
              placeholder="Section subtitle..."
              rows={2}
            />
          </div>
        </div>
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
