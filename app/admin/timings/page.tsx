"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SearchBox from "@/components/admin/common/SearchBox";
import TimingTable from "@/components/admin/timings/TimingTable";
import { Button } from "@/components/ui/button";
import { timingService } from "@/services/timing.service";
import { TempleTiming } from "@/types/timing";

export default function AdminTimingsPage() {
  const [timings, setTimings] = useState<TempleTiming[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadTimings() {
    try {
      setLoading(true);
      const data = await timingService.getTimings();
      setTimings(data);
    } catch (error) {
      console.error("Failed to load timings:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTimings();
  }, []);

  const filteredTimings = timings.filter((timing) => {
    const keyword = search.toLowerCase();
    return (
      timing.title.toLowerCase().includes(keyword) ||
      timing.description.toLowerCase().includes(keyword) ||
      timing.startTime.toLowerCase().includes(keyword) ||
      timing.endTime.toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Temple Timings"
        description="Manage the public temple timings shown on the homepage."
        action={
          <Button asChild>
            <Link href="/admin/timings/new">
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add Timing
              </span>
            </Link>
          </Button>
        }
      />

      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">
              Temple Timing Schedule
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Add, update, and reorder timings for devotees.
            </p>
          </div>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search timings..."
          />
        </div>

        {loading ? (
          <div className="mt-8 text-stone-500">Loading timings...</div>
        ) : (
          <div className="mt-8">
            <TimingTable timings={filteredTimings} onRefresh={loadTimings} />
          </div>
        )}
      </div>
    </div>
  );
}
