"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import PoojaTable from "@/components/admin/pooja/PoojaTable";
import PoojaStats from "@/components/admin/pooja/PoojaStats";
import SearchBox from "@/components/admin/common/SearchBox";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import { DailyPooja } from "@/types/pooja";
import { poojaService } from "@/services/pooja.service";
export default function PoojaPage() {
  const [poojas, setPoojas] = useState<DailyPooja[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const loadPoojas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await poojaService.getPoojas();
      setPoojas(data);
    } catch (error) {
      console.error("Failed to load poojas:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPoojas();
  }, []);

  const filteredPoojas = poojas.filter((pooja) => {
    const keyword = search.toLowerCase();
    return (
      pooja.title.toLowerCase().includes(keyword) ||
      pooja.description.toLowerCase().includes(keyword) ||
      pooja.category.toLowerCase().includes(keyword) ||
      pooja.notes.toLowerCase().includes(keyword)
    );
  });
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Daily Pooja Management"
        description="Manage temple daily pooja schedule, timings, and seva amounts."
        action={
          <Link
            href="/admin/pooja/create"
            className="inline-flex items-center justify-center font-medium transition bg-orange-600 hover:bg-orange-700 text-white h-11 rounded-lg px-4 py-3"
          >
            Add Pooja
          </Link>
        }
      />
      <PoojaStats />
      <div className="flex items-center justify-between gap-4">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search by title, category, or notes..."
        />
      </div>
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">Loading poojas...</p>
        </div>
      ) : (
        <PoojaTable poojas={filteredPoojas} onRefresh={loadPoojas} />
      )}
    </div>
  );
}
