"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SearchBox from "@/components/admin/common/SearchBox";
import CrudTable from "@/components/admin/crud/CrudTable";
import Button from "@/components/ui/button";

import { timingService } from "@/services/timing.service";
import { TempleTiming } from "@/types/timing";

import { timingColumns } from "./columns";

export default function TimingsPage() {
  const router = useRouter();

  const [timings, setTimings] = useState<
    TempleTiming[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadTimings() {
    try {
      setLoading(true);

      const data =
        await timingService.getTimings();

      setTimings(data);
    } catch (error) {
      console.error(
        "Failed to load timings:",
        error
      );

      toast.error("Failed to load timings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTimings();
  }, []);

  const filteredTimings = useMemo(() => {
    const keyword = search
      .toLowerCase()
      .trim();

    if (!keyword) return timings;

    return timings.filter((timing) =>
      [
        timing.title,
        timing.description,
        timing.startTime,
        timing.endTime,
      ].some((value) =>
        value
          .toLowerCase()
          .includes(keyword)
      )
    );
  }, [timings, search]);

  async function handleDelete(
    timing: TempleTiming
  ) {
    if (
      !window.confirm(
        `Delete "${timing.title}"?`
      )
    ) {
      return;
    }

    try {
      await timingService.deleteTiming(
        timing.id
      );

      toast.success(
        "Timing deleted successfully."
      );

      await loadTimings();
    } catch (error) {
      console.error(
        "Failed to delete timing:",
        error
      );

      toast.error(
        "Failed to delete timing."
      );
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Temple Timings"
        description="Manage temple timings."
        action={
          <Button asChild>
            <Link href="/admin/timings/new">
              Add Timing
            </Link>
          </Button>
        }
      />

      <SearchBox
        value={search}
        onChange={setSearch}
        placeholder="Search timings..."
      />

      {loading ? (
        <div className="rounded-xl border bg-white p-8">
          Loading timings...
        </div>
      ) : (
        <CrudTable<TempleTiming>
          data={filteredTimings}
          columns={timingColumns}
          emptyMessage="No timings found."
          actions={{
            onEdit: (timing) =>
              router.push(
                `/admin/timings/${timing.id}/edit`
              ),

            onDelete: handleDelete,
          }}
        />
      )}
    </div>
  );
}
