"use client";

import { Search } from "lucide-react";

interface CalendarSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function CalendarSearch({
  value,
  onChange,
}: CalendarSearchProps) {
  return (
    <div className="relative max-w-md">

      <Search
        size={18}
        className="absolute left-4 top-3.5 text-stone-400"
      />

      <input
        type="text"
        placeholder="Search..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-stone-300 bg-white py-3 pl-11 pr-4 outline-none transition focus:border-amber-500"
      />

    </div>
  );
}
