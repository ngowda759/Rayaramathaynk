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
import { BillingSettings } from "@/types/finance";

const SETTINGS_DOC = "financeSettings";
const SETTINGS_COLLECTION = "settings";

const defaultBillingSettings: BillingSettings = {
  invoicePrefix: "INV",
  invoiceNumber: 1000,
  defaultDueDays: 15,
  taxRate: 0,
  currency: "INR",
  companyName: "",
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  companyGstin: "",
  notes: "Thank you for your contribution.",
};

export default function BillingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BillingSettings>(defaultBillingSettings);

  useEffect(() => {
    async function loadSettings() {
      try {
        if (!db) {
          setLoading(false);
          return;
        }
        const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.billing) {
            // Merge with defaults to ensure all fields exist
            setSettings({
              ...defaultBillingSettings,
              ...data.billing,
            });
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function saveSettings() {
    if (!db) {
      toast.error("Firebase not configured");
      return;
    }
    setSaving(true);
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
      await setDoc(
        docRef,
        {
          billing: settings,
          billingEnabled: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      toast.success("Billing settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    if (confirm("Are you sure you want to reset billing settings to defaults?")) {
      setSettings({
        invoicePrefix: "INV",
        invoiceNumber: 1000,
        defaultDueDays: 15,
        taxRate: 0,
        currency: "INR",
        companyName: "",
        companyAddress: "",
        companyPhone: "",
        companyEmail: "",
        companyGstin: "",
        notes: "Thank you for your contribution.",
      });
      toast.success("Settings reset to defaults. Click Save to apply.");
    }
  }

  function updateField(field: keyof BillingSettings, value: string | number) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/billing"
          className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <AdminPageHeader
          title="Billing Settings"
          description="Configure billing preferences and company information for invoices."
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={resetToDefaults}
          className="border-stone-300"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button
          onClick={saveSettings}
          disabled={saving}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Invoice Settings */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Invoice Settings</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Invoice Prefix
            </label>
            <Input
              type="text"
              value={settings.invoicePrefix}
              onChange={(e) => updateField("invoicePrefix", e.target.value.toUpperCase())}
              placeholder="INV"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Next Invoice Number
            </label>
            <Input
              type="number"
              value={settings.invoiceNumber}
              onChange={(e) => updateField("invoiceNumber", parseInt(e.target.value) || 1000)}
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Default Due Days
            </label>
            <Input
              type="number"
              value={settings.defaultDueDays}
              onChange={(e) => updateField("defaultDueDays", parseInt(e.target.value) || 15)}
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Currency
            </label>
            <select
              value={settings.currency}
              onChange={(e) => updateField("currency", e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            >
              <option value="INR">INR - Indian Rupee</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Default Tax Rate (%)
            </label>
            <Input
              type="number"
              value={settings.taxRate}
              onChange={(e) => updateField("taxRate", parseFloat(e.target.value) || 0)}
              min="0"
              max="100"
              step="0.01"
            />
          </div>
        </div>
      </div>

      {/* Company Information */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Company Information</h3>
        <p className="text-sm text-stone-500 mb-6">
          This information will appear on all invoices generated.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Company / Temple Name
            </label>
            <Input
              type="text"
              value={settings.companyName}
              onChange={(e) => updateField("companyName", e.target.value)}
              placeholder="Sri Rayara Matha Trust"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              GSTIN
            </label>
            <Input
              type="text"
              value={settings.companyGstin}
              onChange={(e) => updateField("companyGstin", e.target.value.toUpperCase())}
              placeholder="29AAAAA0000A1Z5"
              maxLength={15}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Phone
            </label>
            <Input
              type="tel"
              value={settings.companyPhone}
              onChange={(e) => updateField("companyPhone", e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Email
            </label>
            <Input
              type="email"
              value={settings.companyEmail}
              onChange={(e) => updateField("companyEmail", e.target.value)}
              placeholder="accounts@temple.org"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Address
            </label>
            <Textarea
              value={settings.companyAddress}
              onChange={(e) => updateField("companyAddress", e.target.value)}
              placeholder="Temple Address"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Invoice Notes */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Invoice Notes</h3>
        <Textarea
          value={settings.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          placeholder="Default notes that appear on all invoices..."
          rows={3}
        />
        <p className="mt-2 text-sm text-stone-500">
          These notes will appear at the bottom of every invoice.
        </p>
      </div>

      <div className="flex justify-end gap-4 pb-6">
        <Link href="/admin/billing">
          <Button variant="outline" className="border-stone-300">
            Cancel
          </Button>
        </Link>
        <Button
          onClick={saveSettings}
          disabled={saving}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
