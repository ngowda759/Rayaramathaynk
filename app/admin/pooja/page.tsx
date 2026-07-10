"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

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

  async function loadPoojas() {
    try {
      const data = await poojaService.getPoojas();
      setPoojas(data);
    } catch (error) {
      console.error("Failed to load poojas:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
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
          <Button asChild>
            <Link href="/admin/pooja/create">Add Pooja</Link>
          </Button>
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
