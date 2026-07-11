"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, RotateCcw, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SocialLinksData {
  facebook: string;
  instagram: string;
  youtube: string;
  whatsapp: string;
  twitter: string;
  linkedin: string;
  mapUrl: string;
  
  // Display settings
  showFacebook: boolean;
  showInstagram: boolean;
  showYoutube: boolean;
  showWhatsapp: boolean;
  showTwitter: boolean;
  showLinkedin: boolean;
  showMap: boolean;
}

const COLLECTION = "settings";
const DOCUMENT = "socialLinks";

const defaultData: SocialLinksData = {
  facebook: "https://www.facebook.com/srs.mutt.yelahanka.newtown",
  instagram: "https://www.instagram.com/srs_mutt_yelahanka_newtown",
  youtube: "https://www.youtube.com/@Guru_Raghavendra_Rayaru",
  whatsapp: "https://whatsapp.com/channel/0029VbDCCue5Ejy3d6EQfh1g",
  twitter: "",
  linkedin: "",
  mapUrl: "https://maps.app.goo.gl/JKqBSh7AdNAC6E9d8",
  
  showFacebook: true,
  showInstagram: true,
  showYoutube: true,
  showWhatsapp: true,
  showTwitter: false,
  showLinkedin: false,
  showMap: true,
};

export default function SocialLinksSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<SocialLinksData>(defaultData);

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
          setData({ ...defaultData, ...docSnap.data() } as SocialLinksData);
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

      toast.success("Social links saved successfully!");
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof SocialLinksData, value: string | boolean) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
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
          title="Social Links Settings"
          description="Configure social media links and contact information."
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
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Facebook */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-900">Facebook</h3>
              <p className="text-sm text-stone-500">Connect with us on Facebook</p>
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.showFacebook}
              onChange={(e) => updateField("showFacebook", e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-stone-700">Show</span>
          </label>
        </div>
        <div className="relative">
          <Input
            type="url"
            value={data.facebook}
            onChange={(e) => updateField("facebook", e.target.value)}
            placeholder="https://www.facebook.com/..."
            className="pr-10"
          />
          {data.facebook && (
            <a
              href={data.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Instagram */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-orange-500 text-white">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-900">Instagram</h3>
              <p className="text-sm text-stone-500">Follow us on Instagram</p>
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.showInstagram}
              onChange={(e) => updateField("showInstagram", e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-pink-600 focus:ring-pink-500"
            />
            <span className="text-sm font-medium text-stone-700">Show</span>
          </label>
        </div>
        <div className="relative">
          <Input
            type="url"
            value={data.instagram}
            onChange={(e) => updateField("instagram", e.target.value)}
            placeholder="https://www.instagram.com/..."
            className="pr-10"
          />
          {data.instagram && (
            <a
              href={data.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* YouTube */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-900">YouTube</h3>
              <p className="text-sm text-stone-500">Subscribe to our channel</p>
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.showYoutube}
              onChange={(e) => updateField("showYoutube", e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm font-medium text-stone-700">Show</span>
          </label>
        </div>
        <div className="relative">
          <Input
            type="url"
            value={data.youtube}
            onChange={(e) => updateField("youtube", e.target.value)}
            placeholder="https://www.youtube.com/@..."
            className="pr-10"
          />
          {data.youtube && (
            <a
              href={data.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* WhatsApp */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-900">WhatsApp</h3>
              <p className="text-sm text-stone-500">Join our WhatsApp channel</p>
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.showWhatsapp}
              onChange={(e) => updateField("showWhatsapp", e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-sm font-medium text-stone-700">Show</span>
          </label>
        </div>
        <div className="relative">
          <Input
            type="url"
            value={data.whatsapp}
            onChange={(e) => updateField("whatsapp", e.target.value)}
            placeholder="https://whatsapp.com/channel/..."
            className="pr-10"
          />
          {data.whatsapp && (
            <a
              href={data.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Twitter/X */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-900">X (Twitter)</h3>
              <p className="text-sm text-stone-500">Follow us on X</p>
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.showTwitter}
              onChange={(e) => updateField("showTwitter", e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-black focus:ring-gray-500"
            />
            <span className="text-sm font-medium text-stone-700">Show</span>
          </label>
        </div>
        <Input
          type="url"
          value={data.twitter}
          onChange={(e) => updateField("twitter", e.target.value)}
          placeholder="https://x.com/..."
        />
      </div>

      {/* LinkedIn */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-white">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-900">LinkedIn</h3>
              <p className="text-sm text-stone-500">Connect on LinkedIn</p>
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.showLinkedin}
              onChange={(e) => updateField("showLinkedin", e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-blue-700 focus:ring-blue-600"
            />
            <span className="text-sm font-medium text-stone-700">Show</span>
          </label>
        </div>
        <Input
          type="url"
          value={data.linkedin}
          onChange={(e) => updateField("linkedin", e.target.value)}
          placeholder="https://www.linkedin.com/company/..."
        />
      </div>

      {/* Google Maps */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C7.802 0 4.425 3.378 4.425 7.575c0 5.681 7.575 14.425 7.575 14.425s7.575-8.744 7.575-14.425C19.575 3.378 16.198 0 12 0zm0 10.625a3.05 3.05 0 110 6.1 3.05 3.05 0 010-6.1z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-900">Google Maps</h3>
              <p className="text-sm text-stone-500">Link to temple location</p>
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.showMap}
              onChange={(e) => updateField("showMap", e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm font-medium text-stone-700">Show</span>
          </label>
        </div>
        <div className="relative">
          <Input
            type="url"
            value={data.mapUrl}
            onChange={(e) => updateField("mapUrl", e.target.value)}
            placeholder="https://maps.app.goo.gl/..."
            className="pr-10"
          />
          {data.mapUrl && (
            <a
              href={data.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      <div className="flex justify-end pb-6">
        <Button
          onClick={saveData}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
