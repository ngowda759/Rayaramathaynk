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

interface Activity {
  id: string;
  title: string;
  description: string;
}

interface AboutUsData {
  // Hero Section
  templeName: string;
  templeNameKannada: string;
  tagline: string;
  taglineKannada: string;
  tagline2: string;
  heroImageUrl: string;
  
  // Sacred Motto
  sacredMotto: string;
  
  // About Section
  aboutTitle: string;
  aboutContent: string;
  aboutContentKannada: string;
  
  // Activities Section
  activitiesTitle: string;
  activities: Activity[];
  
  // Seva Section
  sevaTitle: string;
  sevaContent: string;
  sevaContentKannada: string;
  sevaItems: string[];
  
  // Resources Section
  resourcesTitle: string;
  resourcesContent: string;
  
  // Visit Section
  visitTitle: string;
  address: string;
  phone: string;
  phone2: string;
  email: string;
  
  // Community Section
  communityTitle: string;
  communityContent: string;
  communityContentKannada: string;
  communityQuote: string;
  communityQuoteKannada: string;
}

const COLLECTION = "settings";
const DOCUMENT = "aboutUs";

const defaultData: AboutUsData = {
  templeName: "Sri Gururaja Seva Samiti (R)",
  templeNameKannada: "ಶ್ರೀ ಗುರುರಾಜ ಸೇವಾ ಸಮಿತಿ (ರಿ)",
  tagline: "Sri Gururaja Seva Samiti (R)",
  taglineKannada: "ಶ್ರೀ ಗುರುರಾಜ ಸೇವಾ ಸಮಿತಿ (ರಿ)",
  tagline2: "Maintained by the Sri Sri Raghavendraswamy Brindavan Seva Samithi Trust (R) | Yelahanka New Town, Bengaluru",
  heroImageUrl: "",
  
  sacredMotto: "ಹರಿ ಸರ್ವೋತ್ತಮ • Hari Sarvottama • ವಾಯು ಜೀವೋತ್ತಮ • Vāyu Jīvōttama • ಗುರುರಾಜೋ ವಿಜಯತೇ • Gururājō Vijayate",
  
  aboutTitle: "About the Temple",
  aboutContent: "A sacred space blessed with the divine presence of Sri Raghavendra Swamy, this temple serves as a spiritual haven for devotees in the Yelahanka New Town community.",
  aboutContentKannada: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಗಳ ದಿವ್ಯ ಸಾನ್ನಿಧ್ಯದಿಂದ ಪಾವನವಾದ ಪವಿತ್ರ ಸ್ಥಳ, ಈ ದೇವಸ್ಥಾನವು ಯೆಲಹಂಕ ನ್ಯೂ ಟೌನ್ ಸಮುದಾಯದ ಭಕ್ತರಿಗೆ ಆಧ್ಯಾತ್ಮಿಕ ಆಶ್ರಯವಾಗಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ.",
  
  activitiesTitle: "Our Activities",
  activities: [
    { id: "1", title: "Daily Poojas", description: "Morning and evening rituals including Suprabhata, Archane, and Harathi" },
    { id: "2", title: "Special Sevas", description: "Weekly and monthly sevas including Archane with Harathi, Annadana, and more" },
    { id: "3", title: "Festivals", description: "Celebration of all Hindu festivals including Gururaja Aradhana, Ram Navami, and Janmashtami" },
    { id: "4", title: "Spiritual Discourses", description: "Regular bhajans, pravachanas, and religious lectures" },
  ],
  
  sevaTitle: "Seva Offerings",
  sevaContent: "We offer various sevas (services) that devotees can book to participate in temple activities and earn punya:",
  sevaContentKannada: "ಭಕ್ತರು ದೇವಸ್ಥಾನದ ಚಟುವಟಿಕೆಗಳಲ್ಲಿ ಭಾಗವಹಿಸಲು ಮತ್ತು ಪುಣ್ಯ ಗಳಿಸಲು ಬುಕ್ ಮಾಡಬಹುದಾದ ವಿವಿಧ ಸೇವೆಗಳನ್ನು ನಾವು ನೀಡುತ್ತೇವೆ:",
  sevaItems: [
    "Online Seva Booking - Book sevas conveniently from home",
    "Donation and Annadana Seva",
    "Special Poojas and Archane",
    "Vahanarchane and Ratha Utsava participation",
  ],
  
  resourcesTitle: "Spiritual Resources",
  resourcesContent: "Access sacred hymns, prayers, and stotrams for your daily worship.",
  
  visitTitle: "Visit Us",
  address: "428/20, 8th A Cross Rd, Yelahanka Satellite Town, Yelahanka, Bengaluru, Karnataka 560064",
  phone: "+91 80 2332 3456",
  phone2: "+91 80 2332 3456",
  email: "info@rayaramathaynk.com",
  
  communityTitle: "Join Our Community",
  communityContent: "We welcome all devotees to participate in our temple activities, events, and community gatherings.",
  communityContentKannada: "ನಾವು ಎಲ್ಲಾ ಭಕ್ತರನ್ನು ನಮ್ಮ ದೇವಸ್ಥಾನದ ಚಟುವಟಿಕೆಗಳು, ಕಾರ್ಯಕ್ರಮಗಳು ಮತ್ತು ಸಮುದಾಯ ಸಭೆಗಳಲ್ಲಿ ಭಾಗವಹಿಸಲು ಸ್ವಾಗತಿಸುತ್ತೇವೆ.",
  communityQuote: "May we all be protected, nourished, and blessed with strength together.",
  communityQuoteKannada: "ಓಂ ಸಹ ನಾವವತು | ಸಹ ನೌ ಭುನಕ್ತು | ಸಹ ವೀರ್ಯಂ ಕರವಾವಹೈ |",
};

export default function AboutUsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<AboutUsData>(defaultData);

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
          setData({ ...defaultData, ...docSnap.data() } as AboutUsData);
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

      toast.success("About Us saved successfully!");
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof AboutUsData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function updateActivity(id: string, field: keyof Activity, value: string) {
    setData((prev) => ({
      ...prev,
      activities: prev.activities.map((a) =>
        a.id === id ? { ...a, [field]: value } : a
      ),
    }));
  }

  function addActivity() {
    const newActivity: Activity = {
      id: Date.now().toString(),
      title: "",
      description: "",
    };
    setData((prev) => ({ ...prev, activities: [...prev.activities, newActivity] }));
  }

  function removeActivity(id: string) {
    if (confirm("Are you sure you want to remove this activity?")) {
      setData((prev) => ({
        ...prev,
        activities: prev.activities.filter((a) => a.id !== id),
      }));
    }
  }

  function updateSevaItem(index: number, value: string) {
    setData((prev) => {
      const newItems = [...prev.sevaItems];
      newItems[index] = value;
      return { ...prev, sevaItems: newItems };
    });
  }

  function addSevaItem() {
    setData((prev) => ({
      ...prev,
      sevaItems: [...prev.sevaItems, ""],
    }));
  }

  function removeSevaItem(index: number) {
    setData((prev) => ({
      ...prev,
      sevaItems: prev.sevaItems.filter((_, i) => i !== index),
    }));
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
          title="About Us Settings"
          description="Configure the About Us page content."
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
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Temple Name (English)
            </label>
            <Input
              type="text"
              value={data.templeName}
              onChange={(e) => updateField("templeName", e.target.value)}
              placeholder="Sri Gururaja Seva Samiti (R)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Temple Name (Kannada)
            </label>
            <Input
              type="text"
              value={data.templeNameKannada}
              onChange={(e) => updateField("templeNameKannada", e.target.value)}
              placeholder="ಶ್ರೀ ಗುರುರಾಜ ಸೇವಾ ಸಮಿತಿ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Tagline (English)
            </label>
            <Input
              type="text"
              value={data.tagline}
              onChange={(e) => updateField("tagline", e.target.value)}
              placeholder="Sri Gururaja Seva Samiti (R)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Tagline (Kannada)
            </label>
            <Input
              type="text"
              value={data.taglineKannada}
              onChange={(e) => updateField("taglineKannada", e.target.value)}
              placeholder="ಶ್ರೀ ಗುರುರಾಜ ಸೇವಾ ಸಮಿತಿ"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Tagline Line 2 (Location info)
            </label>
            <Input
              type="text"
              value={data.tagline2}
              onChange={(e) => updateField("tagline2", e.target.value)}
              placeholder="Maintained by... | Yelahanka New Town, Bengaluru"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Hero Image URL (optional - displays Hero.jpg automatically)
            </label>
            <Input
              type="text"
              value={data.heroImageUrl}
              onChange={(e) => updateField("heroImageUrl", e.target.value)}
              placeholder="/images/Hero.jpg"
            />
            <p className="text-xs text-stone-500 mt-1">Leave empty to auto-display Hero.jpg from public/images folder</p>
          </div>
        </div>
      </div>

      {/* Sacred Motto Section */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Sacred Motto</h3>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Motto (use • as separator)
          </label>
          <Input
            type="text"
            value={data.sacredMotto}
            onChange={(e) => updateField("sacredMotto", e.target.value)}
            placeholder="ಹರಿ ಸರ್ವೋತ್ತಮ • Hari Sarvottama • ..."
          />
          <p className="text-xs text-stone-500 mt-1">Separate each phrase with • symbol</p>
        </div>
      </div>

      {/* About Section */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">About Section</h3>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Section Title
            </label>
            <Input
              type="text"
              value={data.aboutTitle}
              onChange={(e) => updateField("aboutTitle", e.target.value)}
              placeholder="About the Temple"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Content (English)
            </label>
            <Textarea
              value={data.aboutContent}
              onChange={(e) => updateField("aboutContent", e.target.value)}
              placeholder="About the temple..."
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Content (Kannada)
            </label>
            <Textarea
              value={data.aboutContentKannada}
              onChange={(e) => updateField("aboutContentKannada", e.target.value)}
              placeholder="ದೇವಸ್ಥಾನದ ಬಗ್ಗೆ..."
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Activities Section */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Our Activities</h3>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Section Title
            </label>
            <Input
              type="text"
              value={data.activitiesTitle}
              onChange={(e) => updateField("activitiesTitle", e.target.value)}
              placeholder="Our Activities"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-stone-700">
                Activities
              </label>
              <Button onClick={addActivity} size="sm" variant="outline">
                <Plus className="mr-1 h-3 w-3" />
                Add Activity
              </Button>
            </div>
            <div className="space-y-4">
              {data.activities.map((activity) => (
                <div key={activity.id} className="p-4 bg-stone-50 rounded-lg border">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-stone-600">Activity {data.activities.indexOf(activity) + 1}</span>
                    <button
                      onClick={() => removeActivity(activity.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      type="text"
                      value={activity.title}
                      onChange={(e) => updateActivity(activity.id, "title", e.target.value)}
                      placeholder="Activity name"
                    />
                    <Input
                      type="text"
                      value={activity.description}
                      onChange={(e) => updateActivity(activity.id, "description", e.target.value)}
                      placeholder="Brief description"
                    />
                  </div>
                </div>
              ))}
            </div>
            {data.activities.length === 0 && (
              <div className="text-center py-8 text-stone-500">
                No activities added yet. Click &ldquo;Add Activity&rdquo; to create one.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seva Section */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Seva Offerings Section</h3>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Section Title
            </label>
            <Input
              type="text"
              value={data.sevaTitle}
              onChange={(e) => updateField("sevaTitle", e.target.value)}
              placeholder="Seva Offerings"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Content (English)
            </label>
            <Textarea
              value={data.sevaContent}
              onChange={(e) => updateField("sevaContent", e.target.value)}
              placeholder="We offer various sevas..."
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Content (Kannada)
            </label>
            <Textarea
              value={data.sevaContentKannada}
              onChange={(e) => updateField("sevaContentKannada", e.target.value)}
              placeholder="ನಾವು ವಿವಿಧ ಸೇವೆಗಳನ್ನು ನೀಡುತ್ತೇವೆ..."
              rows={2}
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-stone-700">
                Seva Items
              </label>
              <Button onClick={addSevaItem} size="sm" variant="outline">
                <Plus className="mr-1 h-3 w-3" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {data.sevaItems.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="text"
                    value={item}
                    onChange={(e) => updateSevaItem(index, e.target.value)}
                    placeholder="Seva item"
                  />
                  <button
                    onClick={() => removeSevaItem(index)}
                    className="text-red-500 hover:text-red-700 p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Visit Section */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Visit Us Section</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Section Title
            </label>
            <Input
              type="text"
              value={data.visitTitle}
              onChange={(e) => updateField("visitTitle", e.target.value)}
              placeholder="Visit Us"
            />
          </div>
          <div></div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Address
            </label>
            <Textarea
              value={data.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="Address..."
              rows={4}
            />
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Phone 1
              </label>
              <Input
                type="text"
                value={data.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+91 99002 15389"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Phone 2
              </label>
              <Input
                type="text"
                value={data.phone2}
                onChange={(e) => updateField("phone2", e.target.value)}
                placeholder="+91 98450 79474"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Email
              </label>
              <Input
                type="email"
                value={data.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="email@example.com"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Community Section */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Community Section</h3>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Section Title
            </label>
            <Input
              type="text"
              value={data.communityTitle}
              onChange={(e) => updateField("communityTitle", e.target.value)}
              placeholder="Join Our Community"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Content (English)
            </label>
            <Textarea
              value={data.communityContent}
              onChange={(e) => updateField("communityContent", e.target.value)}
              placeholder="We welcome all devotees..."
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Content (Kannada)
            </label>
            <Textarea
              value={data.communityContentKannada}
              onChange={(e) => updateField("communityContentKannada", e.target.value)}
              placeholder="ನಾವು ಎಲ್ಲಾ ಭಕ್ತರನ್ನು ಸ್ವಾಗತಿಸುತ್ತೇವೆ..."
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Quote (English)
            </label>
            <Input
              type="text"
              value={data.communityQuote}
              onChange={(e) => updateField("communityQuote", e.target.value)}
              placeholder="May we all be protected..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Quote (Kannada)
            </label>
            <Input
              type="text"
              value={data.communityQuoteKannada}
              onChange={(e) => updateField("communityQuoteKannada", e.target.value)}
              placeholder="ಓಂ ಸಹ ನಾವವತು..."
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
