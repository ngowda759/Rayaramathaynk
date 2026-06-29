"use client";

import { Search } from "lucide-react";

interface SearchBarProps {
  placeholder?: string;
}

export default function SearchBar({
  placeholder = "Search...",
}: SearchBarProps) {
  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

      <input
        className="w-full rounded-xl border bg-background py-2 pl-10 pr-4 outline-none transition focus:ring-2 focus:ring-orange-500"
        placeholder={placeholder}
      />
    </div>
  );
}
