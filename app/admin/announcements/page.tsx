"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import { announcementService } from "@/services/announcement.service";
import { Announcement } from "@/types/announcement";

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function showStatus(message: string) {
    setStatusMessage(message);
    window.setTimeout(() => setStatusMessage(""), 4000);
  }

  async function loadAnnouncements() {
    try {
      setLoading(true);
      const data = await announcementService.getAnnouncements();
      setAnnouncements(data);
    } catch (error) {
      console.error("Failed to load announcements:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnnouncements();
  }, []);

  function resetForm() {
    setTitle("");
    setMessage("");
    setLink("");
    setIsActive(true);
    setEditingAnnouncementId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      if (editingAnnouncementId) {
        await announcementService.updateAnnouncement(editingAnnouncementId, {
          title,
          message,
          link,
          isActive,
        });
      } else {
        await announcementService.addAnnouncement({
          title,
          message,
          link,
          isActive,
        });
      }

      resetForm();
      await loadAnnouncements();
      showStatus("Announcement saved successfully.");
    } catch (error) {
      console.error("Failed to save announcement:", error);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(announcement: Announcement) {
    setEditingAnnouncementId(announcement.id);
    setTitle(announcement.title);
    setMessage(announcement.message);
    setLink(announcement.link || "");
    setIsActive(announcement.isActive);
  }

  async function handleToggleActive(announcement: Announcement) {
    setSaving(true);

    try {
      await announcementService.updateAnnouncement(announcement.id, {
        isActive: !announcement.isActive,
      });
      if (editingAnnouncementId === announcement.id) {
        setIsActive(!announcement.isActive);
      }
      await loadAnnouncements();
    } catch (error) {
      console.error("Failed to update announcement status:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Delete this announcement? This cannot be undone.");
    if (!confirmed) return;

    setSaving(true);
    try {
      await announcementService.deleteAnnouncement(id);
      if (editingAnnouncementId === id) {
        resetForm();
      }
      await loadAnnouncements();
    } catch (error) {
      console.error("Failed to delete announcement:", error);
    } finally {
      setSaving(false);
    }
  }

  const filteredAnnouncements = showActiveOnly
    ? announcements.filter((announcement) => announcement.isActive)
    : announcements;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Announcements"
        description="Create and manage temple announcements shown on the homepage."
      />

      {statusMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          {statusMessage}
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-900">
            Add Announcement
          </h2>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <div className="space-y-2">
              <label className="block text-sm font-medium text-stone-700">
                Message
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                className="min-h-[150px]"
              />
            </div>

            <Input
              label="Link (optional)"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://example.com"
            />

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                />
                Active
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={saving}>
                {editingAnnouncementId ? "Update Announcement" : "Save Announcement"}
              </Button>

              {editingAnnouncementId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-stone-900">
              Existing Announcements
            </h2>

            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
              />
              Show active only
            </label>
          </div>

          {loading ? (
            <div className="mt-6 text-stone-500">Loading announcements...</div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="mt-6 text-stone-500">
              No announcements published yet.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {filteredAnnouncements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="font-semibold text-stone-900">
                        {announcement.title}
                      </h3>
                      <p className="mt-1 text-sm text-stone-600">
                        {announcement.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          announcement.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {announcement.isActive ? "Active" : "Inactive"}
                      </span>

                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 px-3"
                        onClick={() => handleEdit(announcement)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 px-3"
                        onClick={() => handleToggleActive(announcement)}
                      >
                        {announcement.isActive ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="h-9 px-3"
                        onClick={() => handleDelete(announcement.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {announcement.link ? (
                    <p className="mt-3 text-sm text-orange-600">
                      Link: {announcement.link}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
