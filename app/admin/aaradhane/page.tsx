"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import AaradhaneTable from "@/components/admin/aaradhane/AaradhaneTable";
import AaradhaneStats from "@/components/admin/aaradhane/AaradhaneStats";
import SearchBox from "@/components/admin/common/SearchBox";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";

import { Aaradhane } from "@/types/aaradhane";
import { aaradhaneService } from "@/services/aaradhane.service";

export default function AaradhanePage() {
  const [items, setItems] = useState<Aaradhane[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await aaradhaneService.getAaradhanes();
      setItems(data);
    } catch (error) {
      console.error("Failed to load aaradhanes:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadItems();
  }, []);

  const filteredItems = items.filter((item) => {
    const keyword = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(keyword) ||
      item.guruName.toLowerCase().includes(keyword) ||
      item.description.toLowerCase().includes(keyword) ||
      item.significance.toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Aaradhane Management"
        description="Manage temple aaradhane events, rituals, and offerings."
        action={
          <Button asChild>
            <Link href="/admin/aaradhane/create">Add Aaradhane</Link>
          </Button>
        }
      />

      <AaradhaneStats />

      <div className="flex items-center justify-between gap-4">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search by title, guru, or significance..."
        />
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">Loading aaradhanes...</p>
        </div>
      ) : (
        <AaradhaneTable items={filteredItems} onRefresh={loadItems} />
      )}
    </div>
  );
}
