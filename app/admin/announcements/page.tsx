"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SearchBox from "@/components/admin/common/SearchBox";
import CrudTable from "@/components/admin/crud/CrudTable";
import Button from "@/components/ui/button";
import { announcementService } from "@/services/announcement.service";
import { Announcement } from "@/types/announcement";
import { announcementColumns } from "./columns";
export default function AnnouncementsPage() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<
    Announcement[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const data =
        await announcementService.getAnnouncements();
      setAnnouncements(data);
    } catch (error) {
      console.error(
        "Failed to load announcements:",
        error
      );
      toast.error(
        "Failed to load announcements."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAnnouncements();
  }, []);

  const filteredAnnouncements = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    if (!keyword) return announcements;
    return announcements.filter((item) =>
      [
        item.title,
        item.message,
        item.link ?? "",
      ].some((value) =>
        value.toLowerCase().includes(keyword)
      )
    );
  }, [announcements, search]);
  async function handleDelete(
    announcement: Announcement
  ) {
    if (
      !window.confirm(
        `Delete "${announcement.title}"?`
      )
    ) {
      return;
    }
    try {
      await announcementService.deleteAnnouncement(
        announcement.id
      );
      toast.success(
        "Announcement deleted successfully."
      );
      await loadAnnouncements();
    } catch (error) {
      console.error(
        "Failed to delete announcement:",
        error
      );
      toast.error(
        "Failed to delete announcement."
      );
    }
  }
  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Announcements"
        description="Manage temple announcements."
        action={
          <Button asChild>
            <Link href="/admin/announcements/new">
              Add Announcement
            </Link>
          </Button>
        }
      />
      <SearchBox
        value={search}
        onChange={setSearch}
        placeholder="Search announcements..."
      />
      {loading ? (
        <div className="rounded-xl border bg-white p-8">
          Loading announcements...
        </div>
      ) : (
        <CrudTable<Announcement>
          data={filteredAnnouncements}
          columns={announcementColumns}
          emptyMessage="No announcements found."
          actions={{
            onEdit: (announcement) =>
              router.push(
                `/admin/announcements/${announcement.id}/edit`
              ),
            onDelete: handleDelete,
          }}
        />
      )}
    </div>
  );
}
