"use client";

import { ReactNode } from "react";
import SearchBar from "@/components/admin/common/SearchBar";

interface CrudToolbarProps {
  search: string;
  setSearch: (value: string) => void;
  actions?: ReactNode;
  filters?: ReactNode;
}

export default function CrudToolbar({
  search,
  setSearch,
  actions,
  filters,
}: CrudToolbarProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 md:flex-row">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search..."
        />

        {filters}
      </div>

      <div className="flex items-center gap-3">
        {actions}
      </div>
    </div>
  );
}
