"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import { settingsService } from "@/services/settings.service";
import { SiteSettings } from "@/types/settings";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";

function AdminSettingsPageContent() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [templeName, setTempleName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [footerText, setFooterText] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const data = await settingsService.getSettings();
        if (data) {
          setSettings(data);
          setTempleName(data.templeName);
          setContactEmail(data.contactEmail);
          setContactPhone(data.contactPhone);
          setAddress(data.address);
          setFooterText(data.footerText || "");
          setWelcomeMessage(data.welcomeMessage || "");
        }
      } catch (error) {
        console.error("Failed to load site settings:", error);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  function showStatus(message: string) {
    setStatusMessage(message);
    window.setTimeout(() => setStatusMessage(""), 5000);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        templeName,
        contactEmail,
        contactPhone,
        address,
        footerText,
        welcomeMessage,
      };

      if (settings) {
        await settingsService.updateSettings(settings.id, payload);
      } else {
        const id = await settingsService.createSettings(payload);
        setSettings({ id, ...payload, updatedAt: new Date().toISOString() });
      }

      showStatus("Settings saved successfully.");
    } catch (error) {
      console.error("Failed to save site settings:", error);
      showStatus("Unable to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Site Settings"
        description="Update temple contact information and homepage messaging."
      />

      {statusMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          {statusMessage}
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Input
              label="Temple Name"
              value={templeName}
              onChange={(e) => setTempleName(e.target.value)}
              required
            />
            <Input
              label="Contact Email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
            />
            <Input
              label="Contact Phone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              required
            />
            <Input
              label="Footer Text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-stone-700">
              Address
            </label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="min-h-[120px]"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-stone-700">
              Welcome Message
            </label>
            <Textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              className="min-h-[120px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <Button type="submit" loading={saving}>
              Save Settings
            </Button>
            {loading ? (
              <p className="text-sm text-stone-500">Loading current settings...</p>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <AdminAuthGuard requiredPermission="settings">
      <AdminSettingsPageContent />
    </AdminAuthGuard>
  );
}
