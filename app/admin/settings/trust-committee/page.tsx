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

interface CommitteeMember {
  id: string;
  name: string;
  nameKannada: string;
  role: string;
  roleKannada: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
}

interface TrustCommitteeData {
  heading: string;
  headingKannada: string;
  subheading: string;
  subheadingKannada: string;
  members: CommitteeMember[];
}

const COLLECTION = "settings";
const DOCUMENT = "trustCommittee";

const defaultData: TrustCommitteeData = {
  heading: "Trust Committee",
  headingKannada: "ಟ್ರಸ್ಟ್ ಸಮಿತಿ",
  subheading: "Meet the dedicated team behind Sri Raghavendra Swamy Matha",
  subheadingKannada: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠದ ಹಿಂದೆ ಇರುವ ಸಮರ್ಪಣೆಯ ತಂಡವನ್ನು ಭೇಟಿಯಾಗಿ",
  members: [],
};

export default function TrustCommitteeSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<TrustCommitteeData>(defaultData);

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
          setData({ ...defaultData, ...docSnap.data() } as TrustCommitteeData);
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

      toast.success("Trust Committee settings saved successfully!");
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof TrustCommitteeData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function updateMember(id: string, field: keyof CommitteeMember, value: unknown) {
    setData((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === id ? { ...m, [field]: value } : m
      ),
    }));
  }

  function addMember() {
    const newMember: CommitteeMember = {
      id: Date.now().toString(),
      name: "",
      nameKannada: "",
      role: "",
      roleKannada: "",
      imageUrl: "",
      order: data.members.length + 1,
      isActive: true,
    };
    setData((prev) => ({ ...prev, members: [...prev.members, newMember] }));
  }

  function removeMember(id: string) {
    if (confirm("Are you sure you want to remove this member?")) {
      setData((prev) => ({
        ...prev,
        members: prev.members.filter((m) => m.id !== id),
      }));
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
      <div className="flex items-center gap-4">
        <Link
          href="/admin/settings"
          className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <AdminPageHeader
          title="Trust Committee Settings"
          description="Manage Trust Committee members (updated every 2 years)."
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
              placeholder="Trust Committee"
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
              placeholder="ಟ್ರಸ್ಟ್ ಸಮಿತಿ"
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
              placeholder="Meet the team..."
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
              placeholder="ತಂಡವನ್ನು ಭೇಟಿಯಾಗಿ..."
            />
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-900">Committee Members</h3>
          <Button onClick={addMember} size="sm" className="bg-amber-600 hover:bg-amber-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        </div>

        <div className="space-y-6">
          {data.members.sort((a, b) => a.order - b.order).map((member, index) => (
            <div key={member.id} className="rounded-lg border p-4 bg-stone-50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-stone-500">Member #{index + 1}</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={member.isActive}
                      onChange={(e) => updateMember(member.id, "isActive", e.target.checked)}
                      className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm font-medium text-stone-600">Active</span>
                  </label>
                  <button
                    onClick={() => removeMember(member.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Order
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={member.order}
                    onChange={(e) => updateMember(member.id, "order", parseInt(e.target.value) || 1)}
                    className="w-24"
                  />
                </div>
                <div className="md:col-span-2 lg:col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Image URL
                  </label>
                  <Input
                    type="text"
                    value={member.imageUrl}
                    onChange={(e) => updateMember(member.id, "imageUrl", e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Name (English)
                  </label>
                  <Input
                    type="text"
                    value={member.name}
                    onChange={(e) => updateMember(member.id, "name", e.target.value)}
                    placeholder="Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Name (Kannada)
                  </label>
                  <Input
                    type="text"
                    value={member.nameKannada}
                    onChange={(e) => updateMember(member.id, "nameKannada", e.target.value)}
                    placeholder="ಹೆಸರು"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Role (English)
                  </label>
                  <Input
                    type="text"
                    value={member.role}
                    onChange={(e) => updateMember(member.id, "role", e.target.value)}
                    placeholder="President"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Role (Kannada)
                  </label>
                  <Input
                    type="text"
                    value={member.roleKannada}
                    onChange={(e) => updateMember(member.id, "roleKannada", e.target.value)}
                    placeholder="ಅಧ್ಯಕ್ಷರು"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {data.members.length === 0 && (
          <div className="text-center py-8 text-stone-500">
            No members added yet. Click &quot;Add Member&quot; to create one.
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
