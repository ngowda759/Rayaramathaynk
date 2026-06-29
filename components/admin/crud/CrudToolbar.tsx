"use client";

import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";

import SearchBox from "@/components/admin/common/SearchBox";
import { Button } from "@/components/ui/button";

interface CrudToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;

  searchPlaceholder?: string;

  addLabel?: string;
  addHref?: string;

  onRefresh?: () => void;

  actions?: React.ReactNode;

  loading?: boolean;
}

export default function CrudToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  addLabel = "Add New",
  addHref,
  onRefresh,
  actions,
  loading = false,
}: CrudToolbarProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      {/* Search */}
      <div className="w-full lg:max-w-md">
        <SearchBox
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          disabled={loading}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {actions}

        {onRefresh && (
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        )}

        {addHref && (
          <Button asChild>
            <Link href={addHref}>
              <Plus className="mr-2 h-4 w-4" />
              {addLabel}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
