"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, RotateCcw, Eye, EyeOff, CreditCard, Smartphone, Building } from "lucide-react";
import toast from "react-hot-toast";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FinanceSettings, SpecialSeva, defaultFinanceSettings } from "@/types/finance";

const SETTINGS_DOC = "financeSettings";
const SETTINGS_COLLECTION = "settings";

export default function FinanceSettingsPage() {
  const [settings, setSettings] = useState<FinanceSettings>(defaultFinanceSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);

  useEffect(() => {
    async function loadSettings() {
        if (!db) {
          setLoading(false);
          return;
        }
      try {
        const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Ensure billing fields exist even if not in existing data
          setSettings({
            ...defaultFinanceSettings,
            ...data,
            billing: data.billingEnabled !== undefined || data.billing
              ? {
                  invoicePrefix: data.billing?.invoicePrefix || defaultFinanceSettings.billing.invoicePrefix,
                  invoiceNumber: data.billing?.invoiceNumber || defaultFinanceSettings.billing.invoiceNumber,
                  defaultDueDays: data.billing?.defaultDueDays || defaultFinanceSettings.billing.defaultDueDays,
                  taxRate: data.billing?.taxRate ?? defaultFinanceSettings.billing.taxRate,
                  currency: data.billing?.currency || defaultFinanceSettings.billing.currency,
                  companyName: data.billing?.companyName || defaultFinanceSettings.billing.companyName,
                  companyAddress: data.billing?.companyAddress || defaultFinanceSettings.billing.companyAddress,
                  companyPhone: data.billing?.companyPhone || defaultFinanceSettings.billing.companyPhone,
                  companyEmail: data.billing?.companyEmail || defaultFinanceSettings.billing.companyEmail,
                  companyGstin: data.billing?.companyGstin || defaultFinanceSettings.billing.companyGstin,
                  notes: data.billing?.notes || defaultFinanceSettings.billing.notes,
                }
              : defaultFinanceSettings.billing,
            billingEnabled: data.billingEnabled ?? false,
          });
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
      console.log("Saving settings:", settings);
      await setDoc(docRef, {
        ...settings,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      
      toast.success("Finance settings saved successfully!");
    } catch (error: unknown) {
      console.error("Error saving settings:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to save settings: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  }

  function updateField(path: string, value: unknown) {
    setSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let obj: any = newSettings;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return newSettings;
    });
  }

  function updateSeva(id: string, field: keyof SpecialSeva, value: unknown) {
    setSettings(prev => ({
      ...prev,
      specialSevas: prev.specialSevas.map(s => 
        s.id === id ? { ...s, [field]: value } : s
      )
    }));
  }

  function addSeva() {
    const newSeva: SpecialSeva = {
      id: Date.now().toString(),
      title: "",
      description: "",
      amount: 100,
      icon: "heart",
      isActive: true,
      order: settings.specialSevas.length + 1,
    };
    setSettings(prev => ({
      ...prev,
      specialSevas: [...prev.specialSevas, newSeva]
    }));
  }

  function removeSeva(id: string) {
    setSettings(prev => ({
      ...prev,
      specialSevas: prev.specialSevas.filter(s => s.id !== id)
    }));
  }

  function resetToDefaults() {
    if (confirm("Are you sure you want to reset all settings to defaults?")) {
      setSettings(defaultFinanceSettings);
      toast.success("Settings reset to defaults. Click Save to apply.");
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
          <h1 className="text-2xl font-bold text-stone-900">Finance Settings</h1>
          <p className="mt-1 text-sm text-stone-600">
            Configure payment options and special sevas for donations
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
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Module Enable/Disable */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-900">Finance Module</h3>
              <p className="text-sm text-stone-500">Enable donations and payment collection</p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => updateField("enabled", e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-7 w-14 rounded-full bg-stone-200 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:border after:border-stone-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
          </label>
        </div>
      </div>

      {/* Billing Module Enable/Disable */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-stone-900">Billing Module</h3>
              <p className="text-sm text-stone-500">Create and manage invoices, bills and receipts</p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={settings.billingEnabled}
              onChange={(e) => updateField("billingEnabled", e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-7 w-14 rounded-full bg-stone-200 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:border after:border-stone-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-purple-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
          </label>
        </div>
      </div>

      {settings.enabled && (
        <>
          {/* UPI Settings */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900">UPI Payment</h3>
                  <p className="text-sm text-stone-500">Google Pay, PhonePe, Paytm</p>
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.upi.enabled}
                  onChange={(e) => updateField("upi.enabled", e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-7 w-14 rounded-full bg-stone-200 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:border after:border-stone-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>

            {settings.upi.enabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    UPI ID *
                  </label>
                  <input
                    type="text"
                    value={settings.upi.id}
                    onChange={(e) => updateField("upi.id", e.target.value)}
                    placeholder="temple@upi"
                    className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={settings.upi.displayName}
                    onChange={(e) => updateField("upi.displayName", e.target.value)}
                    placeholder="Sri Rayara Matha"
                    className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bank Transfer Settings */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900">Bank Transfer</h3>
                  <p className="text-sm text-stone-500">NEFT, RTGS, IMPS</p>
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.bankTransfer.enabled}
                  onChange={(e) => updateField("bankTransfer.enabled", e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-7 w-14 rounded-full bg-stone-200 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:border after:border-stone-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>

            {settings.bankTransfer.enabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={settings.bankTransfer.accountName}
                    onChange={(e) => updateField("bankTransfer.accountName", e.target.value)}
                    placeholder="Sri Rayara Matha Trust"
                    className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Account Number
                  </label>
                  <input
                    type={showAccountNumber ? "text" : "password"}
                    value={settings.bankTransfer.accountNumber}
                    onChange={(e) => updateField("bankTransfer.accountNumber", e.target.value)}
                    placeholder="1234567890"
                    className="w-full rounded-lg border border-stone-300 px-4 py-2 pr-10 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccountNumber(!showAccountNumber)}
                    className="absolute right-3 top-8 text-stone-400 hover:text-stone-600"
                  >
                    {showAccountNumber ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={settings.bankTransfer.bankName}
                    onChange={(e) => updateField("bankTransfer.bankName", e.target.value)}
                    placeholder="State Bank of India"
                    className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    value={settings.bankTransfer.ifscCode}
                    onChange={(e) => updateField("bankTransfer.ifscCode", e.target.value.toUpperCase())}
                    placeholder="SBIN0001234"
                    className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Branch
                  </label>
                  <input
                    type="text"
                    value={settings.bankTransfer.branch}
                    onChange={(e) => updateField("bankTransfer.branch", e.target.value)}
                    placeholder="Main Branch, Karnataka"
                    className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 md:w-1/2"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Special Sevas */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-stone-900 mb-4">Special Sevas / Donation Options</h3>
            <p className="text-sm text-stone-500 mb-6">
              Configure the donation purposes that appear on the homepage and donation page.
            </p>

            <div className="space-y-4">
              {settings.specialSevas.map((seva, index) => (
                <div
                  key={seva.id}
                  className={`rounded-xl border p-4 ${seva.isActive ? "bg-stone-50" : "bg-stone-100 opacity-60"}`}
                >
                  <div className="flex items-start gap-4">
                    <span className="mt-7 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                      #{index + 1}
                    </span>
                    
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={seva.isActive}
                            onChange={(e) => updateSeva(seva.id, "isActive", e.target.checked)}
                            className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-sm font-medium text-stone-600">Active</span>
                        </label>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1">
                            Title *
                          </label>
                          <input
                            type="text"
                            value={seva.title}
                            onChange={(e) => updateSeva(seva.id, "title", e.target.value)}
                            placeholder="Annadanam"
                            className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1">
                            Amount (₹)
                          </label>
                          <input
                            type="number"
                            value={seva.amount}
                            onChange={(e) => updateSeva(seva.id, "amount", parseInt(e.target.value) || 0)}
                            placeholder="501"
                            className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1">
                            Icon
                          </label>
                          <select
                            value={seva.icon}
                            onChange={(e) => updateSeva(seva.id, "icon", e.target.value)}
                            className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                          >
                            <option value="heart">Heart</option>
                            <option value="cows">Cows</option>
                            <option value="building">Building</option>
                            <option value="book">Book</option>
                            <option value="star">Star</option>
                          </select>
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-sm font-medium text-stone-700 mb-1">
                            Description
                          </label>
                          <textarea
                            value={seva.description}
                            onChange={(e) => updateSeva(seva.id, "description", e.target.value)}
                            placeholder="Description of this donation purpose..."
                            rows={2}
                            className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => removeSeva(seva.id)}
                      className="mt-6 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={addSeva}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 py-4 text-stone-500 hover:border-amber-400 hover:text-amber-600"
              >
                <Plus className="h-5 w-5" />
                Add Seva / Donation Option
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
