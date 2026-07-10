"use client";

import { KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export default function SearchBox({
  value,
  onChange,
  placeholder = "Search...",
  autoFocus = false,
  disabled = false,
  className,
  onKeyDown,
}: SearchBoxProps) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
      />

      <input
        type="search"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        onKeyDown={onKeyDown}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
        className="w-full rounded-lg border border-stone-300 bg-white py-3 pl-10 pr-4 transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:bg-stone-100"
      />
    </div>
  );
}
