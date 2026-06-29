"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SearchBox from "@/components/admin/common/SearchBox";
import CrudTable from "@/components/admin/crud/CrudTable";
import { Button } from "@/components/ui/button";

import { sevaService } from "@/services/seva.service";
import { Seva } from "@/types/seva";
import { sevaColumns } from "./columns";

export default function SevasPage() {
  const router = useRouter();

  const [sevas, setSevas] = useState<Seva[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadSevas() {
    try {
      setLoading(true);

      const data = await sevaService.getAllSevas();

      setSevas(data);
    } catch (error) {
      console.error("Failed to load sevas:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSevas();
  }, []);

  const filteredSevas = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) return sevas;

    return sevas.filter((seva) =>
      [
        seva.name,
        seva.category,
        seva.description,
      ].some((value) =>
        value.toLowerCase().includes(keyword)
      )
    );
  }, [search, sevas]);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Seva Catalog"
        description="Manage temple sevas available for booking."
        action={
          <Button asChild>
            <Link href="/admin/sevas/new">
              Add Seva
            </Link>
          </Button>
        }
      />

      <SearchBox
        value={search}
        onChange={setSearch}
        placeholder="Search sevas..."
      />

      {loading ? (
        <div className="rounded-xl border bg-white p-8">
          Loading sevas...
        </div>
      ) : (
        <CrudTable<Seva>
          data={filteredSevas}
          columns={sevaColumns}
          emptyMessage="No sevas found."
          actions={{
            onEdit: (seva) =>
              router.push(`/admin/sevas/${seva.id}/edit`),

            onDelete: (seva) => {
              console.log(
                "Delete seva:",
                seva.id
              );

              // We'll replace this with the
              // reusable DeleteDialog in a later sprint.
            },
          }}
        />
      )}
    </div>
  );
}
