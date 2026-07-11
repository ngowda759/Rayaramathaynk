"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface FooterData {
  // Logo & Temple Name
  templeName: string;
  templeSubtitle: string;
  logoUrl: string;
  
  // Contact Info
  address: string;
  phone: string;
  phone2: string;
  email: string;
  mapUrl: string;
  
  // Footer Links
  quickLinks: { name: string; href: string }[];
  sevasLinks: { name: string; href: string }[];
  calendarLinks: { name: string; href: string }[];
  
  // Copyright
  copyrightText: string;
  currentYear: boolean; // If true, show current year dynamically
}

const COLLECTION = "settings";
const DOCUMENT = "footer";

const defaultData: FooterData = {
  templeName: "Sri Raghavendra Swamy Matha",
  templeSubtitle: "Yelahanka New Town",
  logoUrl: "/images/logos/ynk_matha_logo.png",
  
  address: "Sri Rayara Matha, Yelahanka New Town, Bengaluru",
  phone: "+91 9886364462",
  phone2: "",
  email: "ngowda759@gmail.com",
  mapUrl: "https://maps.app.goo.gl/JKqBSh7AdNAC6E9d8",
  
  quickLinks: [
    { name: "Home", href: "/" },
    { name: "Aaradhane", href: "/aaradhane" },
    { name: "Facilities", href: "/facilities" },
    { name: "Guru Parampara", href: "/guruparampara" },
    { name: "Gallery", href: "/gallery" },
    { name: "Events", href: "/events" },
    { name: "About", href: "/about" },
    { name: "Shlokas", href: "/shlokas" },
  ],
  
  sevasLinks: [
    { name: "Daily Pooja", href: "/pooja" },
    { name: "Special Sevas", href: "/sevas" },
    { name: "Donate", href: "/donation" },
  ],
  
  calendarLinks: [
    { name: "Ekadasi Calendar", href: "/calendar/ekadashi" },
    { name: "Festival Calendar", href: "/calendar/festivals" },
  ],
  
  copyrightText: "All rights reserved",
  currentYear: true,
};

export default function FooterSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<FooterData>(defaultData);

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
          setData({ ...defaultData, ...docSnap.data() } as FooterData);
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

      toast.success("Footer settings saved successfully!");
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof FooterData, value: string | boolean) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function updateQuickLink(index: number, field: 'name' | 'href', value: string) {
    const newLinks = [...data.quickLinks];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setData((prev) => ({ ...prev, quickLinks: newLinks }));
  }

  function updateSevaLink(index: number, field: 'name' | 'href', value: string) {
    const newLinks = [...data.sevasLinks];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setData((prev) => ({ ...prev, sevasLinks: newLinks }));
  }

  function updateCalendarLink(index: number, field: 'name' | 'href', value: string) {
    const newLinks = [...data.calendarLinks];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setData((prev) => ({ ...prev, calendarLinks: newLinks }));
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-stone-600 border-t-transparent" />
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
          title="Footer Settings"
          description="Configure the website footer content."
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
          className="bg-stone-800 hover:bg-stone-900"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Temple Info */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Temple Information</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Temple Name
            </label>
            <Input
              type="text"
              value={data.templeName}
              onChange={(e) => updateField("templeName", e.target.value)}
              placeholder="Sri Raghavendra Swamy Matha"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Subtitle / Location
            </label>
            <Input
              type="text"
              value={data.templeSubtitle}
              onChange={(e) => updateField("templeSubtitle", e.target.value)}
              placeholder="Yelahanka New Town"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Logo URL
            </label>
            <Input
              type="text"
              value={data.logoUrl}
              onChange={(e) => updateField("logoUrl", e.target.value)}
              placeholder="/images/logos/ynk_matha_logo.png"
            />
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Contact Information</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Address
            </label>
            <Textarea
              value={data.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="Sri Rayara Matha, Yelahanka New Town, Bengaluru"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Phone 1
            </label>
            <Input
              type="text"
              value={data.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="+91 9886364462"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Phone 2 (optional)
            </label>
            <Input
              type="text"
              value={data.phone2}
              onChange={(e) => updateField("phone2", e.target.value)}
              placeholder="+91 9876543210"
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
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Google Maps URL
            </label>
            <Input
              type="text"
              value={data.mapUrl}
              onChange={(e) => updateField("mapUrl", e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
            />
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Quick Links</h3>
        <div className="space-y-3">
          {data.quickLinks.map((link, index) => (
            <div key={index} className="flex gap-2 items-center">
              <span className="text-sm text-stone-500 w-6">{index + 1}.</span>
              <Input
                type="text"
                value={link.name}
                onChange={(e) => updateQuickLink(index, "name", e.target.value)}
                placeholder="Link name"
                className="flex-1"
              />
              <Input
                type="text"
                value={link.href}
                onChange={(e) => updateQuickLink(index, "href", e.target.value)}
                placeholder="/page"
                className="flex-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Sevas Links */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Sevas Links</h3>
        <div className="space-y-3">
          {data.sevasLinks.map((link, index) => (
            <div key={index} className="flex gap-2 items-center">
              <span className="text-sm text-stone-500 w-6">{index + 1}.</span>
              <Input
                type="text"
                value={link.name}
                onChange={(e) => updateSevaLink(index, "name", e.target.value)}
                placeholder="Link name"
                className="flex-1"
              />
              <Input
                type="text"
                value={link.href}
                onChange={(e) => updateSevaLink(index, "href", e.target.value)}
                placeholder="/page"
                className="flex-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Links */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Calendar Links</h3>
        <div className="space-y-3">
          {data.calendarLinks.map((link, index) => (
            <div key={index} className="flex gap-2 items-center">
              <span className="text-sm text-stone-500 w-6">{index + 1}.</span>
              <Input
                type="text"
                value={link.name}
                onChange={(e) => updateCalendarLink(index, "name", e.target.value)}
                placeholder="Link name"
                className="flex-1"
              />
              <Input
                type="text"
                value={link.href}
                onChange={(e) => updateCalendarLink(index, "href", e.target.value)}
                placeholder="/page"
                className="flex-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Copyright */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Copyright</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Copyright Text
            </label>
            <Input
              type="text"
              value={data.copyrightText}
              onChange={(e) => updateField("copyrightText", e.target.value)}
              placeholder="All rights reserved"
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={data.currentYear}
                onChange={(e) => updateField("currentYear", e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-stone-600 focus:ring-stone-500"
              />
              <span className="text-sm font-medium text-stone-700">
                Show current year automatically
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end pb-6">
        <Button
          onClick={saveData}
          disabled={saving}
          className="bg-stone-800 hover:bg-stone-900"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
