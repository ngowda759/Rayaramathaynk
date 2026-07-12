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
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />

      <input
        type="search"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        onKeyDown={onKeyDown}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
        className="h-11 w-full rounded-xl border border-amber-200 bg-white pl-10 pr-4 text-sm outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 focus:shadow-lg focus:shadow-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-stone-400"
      />
    </div>
  );
}
