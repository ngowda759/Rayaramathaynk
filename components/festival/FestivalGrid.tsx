"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, Grid, List, Calendar } from "lucide-react";
import FestivalCard from "./FestivalCard";
import { Festival, MONTH_NAMES } from "@/types/festival";

interface FestivalGridProps {
  festivals: Festival[];
  viewMode?: "grid" | "list";
}

export default function FestivalGrid({ festivals, viewMode: initialViewMode = "grid" }: FestivalGridProps) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">(initialViewMode);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [showMajorOnly, setShowMajorOnly] = useState(false);

  // Get unique months
  const months = useMemo(() => {
    const uniqueMonths = new Set<number>();
    festivals.forEach(f => {
      const month = new Date(f.date).getMonth();
      uniqueMonths.add(month);
    });
    return Array.from(uniqueMonths).sort((a, b) => a - b);
  }, [festivals]);

  // Filter festivals
  const filteredFestivals = useMemo(() => {
    return festivals.filter(festival => {
      // Search filter
      if (search && !festival.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      
      // Month filter
      if (selectedMonth !== null) {
        const festivalMonth = new Date(festival.date).getMonth();
        if (festivalMonth !== selectedMonth) {
          return false;
        }
      }
      
      // Major only filter
      if (showMajorOnly && !festival.isMajor) {
        return false;
      }
      
      return true;
    });
  }, [festivals, search, selectedMonth, showMajorOnly]);

  // Sort by date
  const sortedFestivals = useMemo(() => {
    return [...filteredFestivals].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [filteredFestivals]);

  // Stats
  const stats = useMemo(() => ({
    total: festivals.length,
    major: festivals.filter(f => f.isMajor).length,
    upcoming: festivals.filter(f => new Date(f.date) >= new Date()).length,
  }), [festivals]);

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search festivals..."
            className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Month Filter */}
          <select
            value={selectedMonth ?? ""}
            onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value) : null)}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-700 focus:border-amber-500 focus:outline-none"
          >
            <option value="">All Months</option>
            {months.map(month => (
              <option key={month} value={month}>{MONTH_NAMES[month]}</option>
            ))}
          </select>

          {/* Major Toggle */}
          <button
            onClick={() => setShowMajorOnly(!showMajorOnly)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              showMajorOnly
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
            }`}
          >
            Major Only
          </button>

          {/* View Mode */}
          <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-lg p-2 transition-colors ${
                viewMode === "grid"
                  ? "bg-amber-500 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-lg p-2 transition-colors ${
                viewMode === "list"
                  ? "bg-amber-500 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4">
        <StatBadge icon={<Calendar className="h-4 w-4" />} label="Total" value={stats.total} />
        <StatBadge icon={<span className="h-4 w-4 text-amber-500">⭐</span>} label="Major" value={stats.major} />
        <StatBadge icon={<span className="h-4 w-4 text-green-500">•</span>} label="Upcoming" value={stats.upcoming} />
      </div>

      {/* Results count */}
      <div className="text-sm text-stone-500">
        Showing {sortedFestivals.length} of {festivals.length} festivals
      </div>

      {/* Grid/List View */}
      <AnimatePresence mode="wait">
        {viewMode === "grid" ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {sortedFestivals.map((festival, index) => (
              <FestivalCard key={festival.id} festival={festival} index={index} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {sortedFestivals.map((festival, index) => (
              <FestivalListItem key={festival.id} festival={festival} index={index} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {sortedFestivals.length === 0 && (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-stone-300" />
          <h3 className="mt-4 text-lg font-medium text-stone-900">No festivals found</h3>
          <p className="mt-2 text-stone-500">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
}

function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2">
      {icon}
      <span className="text-sm font-medium text-stone-700">{label}:</span>
      <span className="text-sm font-bold text-stone-900">{value}</span>
    </div>
  );
}

function FestivalListItem({ festival, index }: { festival: Festival; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`flex items-center gap-4 rounded-xl border bg-white p-4 transition-all hover:shadow-md ${
        festival.isMajor ? "border-amber-200" : "border-stone-200"
      }`}
    >
      {/* Date */}
      <div className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-amber-100">
        <span className="text-xs font-medium text-amber-600 uppercase">
          {new Date(festival.date).toLocaleDateString("en-IN", { month: "short" })}
        </span>
        <span className="text-xl font-bold text-amber-700">
          {new Date(festival.date).getDate()}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-stone-900 truncate">{festival.name}</h3>
          {festival.isMajor && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              Major
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-stone-500 truncate">{festival.description}</p>
      </div>

      {/* Day */}
      <div className="hidden text-sm text-stone-400 sm:block">
        {festival.dayOfWeek}
      </div>
    </motion.div>
  );
}
