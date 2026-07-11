"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PoojaTable from "@/components/admin/pooja/PoojaTable";
import PoojaStats from "@/components/admin/pooja/PoojaStats";
import SearchBox from "@/components/admin/common/SearchBox";
import { DailyPooja } from "@/types/pooja";
import { poojaService } from "@/services/pooja.service";
export default function PoojaPage() {
  const router = useRouter();
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Daily Pooja Management</h1>
          <p className="text-sm text-muted-foreground">Manage temple daily pooja schedule, timings, and seva amounts.</p>
        </div>
        <button
          onClick={() => router.push("/admin/pooja/create")}
          className="inline-flex items-center justify-center font-medium transition bg-orange-600 hover:bg-orange-700 text-white h-11 rounded-lg px-4 py-3 cursor-pointer"
        >
          Add Pooja
        </button>
      </div>
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
