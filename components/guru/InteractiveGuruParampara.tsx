"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Filter, LayoutGrid, List, Clock, 
  ChevronRight, BookOpen, Sparkles, Star,
  GraduationCap, Scroll, Calendar
} from "lucide-react";
import Link from "next/link";
import {
  GuruBiography,
  GuruFilterType,
  GuruViewMode,
  GURU_BIOGRAPHIES,
  getFeaturedGurus,
  getMajorGurus,
  searchGurus
} from "@/types/guru";

interface InteractiveGuruParamparaProps {
  initialViewMode?: GuruViewMode;
  initialFilter?: GuruFilterType;
}

export default function InteractiveGuruParampara({
  initialViewMode = "cards",
  initialFilter = "all"
}: InteractiveGuruParamparaProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<GuruFilterType>(initialFilter);
  const [viewMode, setViewMode] = useState<GuruViewMode>(initialViewMode);
  const [expandedGuru, setExpandedGuru] = useState<string | null>(null);

  // Filter and search gurus
  const filteredGurus = useMemo(() => {
    let gurus = GURU_BIOGRAPHIES;

    // Apply filter
    if (filter === "major") {
      gurus = getMajorGurus();
    } else if (filter === "founder") {
      gurus = gurus.filter(g => g.importance === "founder");
    } else if (filter === "minor") {
      gurus = gurus.filter(g => g.importance === "minor");
    }

    // Apply search
    if (searchQuery.trim()) {
      const results = searchGurus(searchQuery);
      const searchIds = new Set(results.map(r => r.guru.id));
      gurus = gurus.filter(g => searchIds.has(g.id));
    }

    return gurus;
  }, [filter, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: GURU_BIOGRAPHIES.length,
    major: getMajorGurus().length,
    founder: 1,
    featured: getFeaturedGurus().length
  }), []);

  return (
    <div className="space-y-8">
      {/* Search and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search gurus, teachings, works..."
            className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Filter */}
          <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1">
            <Filter className="h-4 w-4 text-stone-500 ml-2" />
            {(["all", "major", "minor"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === f
                    ? "bg-amber-500 text-white"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* View Mode */}
          <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1">
            <button
              onClick={() => setViewMode("cards")}
              className={`rounded-lg p-2 transition-colors ${
                viewMode === "cards"
                  ? "bg-amber-500 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`rounded-lg p-2 transition-colors ${
                viewMode === "timeline"
                  ? "bg-amber-500 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
              title="Timeline view"
            >
              <Clock className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-lg p-2 transition-colors ${
                viewMode === "list"
                  ? "bg-amber-500 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<BookOpen className="h-5 w-5" />} label="Total Gurus" value={stats.total} />
        <StatCard icon={<Star className="h-5 w-5" />} label="Major" value={stats.major} />
        <StatCard icon={<Sparkles className="h-5 w-5" />} label="Featured" value={stats.featured} />
        <StatCard icon={<GraduationCap className="h-5 w-5" />} label="Years" value="800+" />
      </div>

      {/* Results count */}
      <div className="text-sm text-stone-500">
        Showing {filteredGurus.length} of {GURU_BIOGRAPHIES.length} gurus
      </div>

      {/* Content based on view mode */}
      <AnimatePresence mode="wait">
        {viewMode === "cards" && (
          <motion.div
            key="cards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filteredGurus.map((guru, index) => (
              <GuruCard
                key={guru.id}
                guru={guru}
                index={index}
                isExpanded={expandedGuru === guru.id}
                onToggle={() => setExpandedGuru(expandedGuru === guru.id ? null : guru.id)}
              />
            ))}
          </motion.div>
        )}

        {viewMode === "timeline" && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative"
          >
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-500 via-orange-500 to-amber-600" />
            
            <div className="space-y-8">
              {filteredGurus.map((guru, index) => (
                <TimelineItem
                  key={guru.id}
                  guru={guru}
                  index={index}
                  isExpanded={expandedGuru === guru.id}
                  onToggle={() => setExpandedGuru(expandedGuru === guru.id ? null : guru.id)}
                />
              ))}
            </div>
          </motion.div>
        )}

        {viewMode === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {filteredGurus.map((guru, index) => (
              <ListItem
                key={guru.id}
                guru={guru}
                isExpanded={expandedGuru === guru.id}
                onToggle={() => setExpandedGuru(expandedGuru === guru.id ? null : guru.id)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {filteredGurus.length === 0 && (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-12 text-center">
          <Search className="mx-auto h-12 w-12 text-stone-300" />
          <h3 className="mt-4 text-lg font-medium text-stone-900">No gurus found</h3>
          <p className="mt-2 text-stone-500">Try adjusting your search or filter</p>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-stone-900">{value}</div>
        <div className="text-sm text-stone-500">{label}</div>
      </div>
    </div>
  );
}

// Guru Card Component
function GuruCard({ 
  guru, 
  index, 
  isExpanded, 
  onToggle 
}: { 
  guru: GuruBiography; 
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`group relative overflow-hidden rounded-2xl border bg-white transition-all duration-300 hover:shadow-lg ${
        guru.importance === "founder" 
          ? "border-amber-400 shadow-amber-100" 
          : guru.importance === "major"
          ? "border-orange-200"
          : "border-stone-200"
      }`}
    >
      {/* Importance indicator */}
      {guru.importance !== "minor" && (
        <div className={`absolute right-0 top-0 rounded-bl-xl px-3 py-1 text-xs font-medium ${
          guru.importance === "founder" 
            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
            : "bg-gradient-to-r from-orange-400 to-amber-400 text-white"
        }`}>
          {guru.importance === "founder" ? "Founder" : "Major"}
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-xl font-bold shadow-lg ${
            guru.importance === "founder"
              ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
              : guru.importance === "major"
              ? "bg-gradient-to-br from-orange-400 to-amber-500 text-white"
              : "bg-gradient-to-br from-stone-400 to-stone-500 text-white"
          }`}>
            {guru.number}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-stone-900">{guru.name}</h3>
            <p className="mt-1 font-serif text-sm italic text-stone-500">{guru.kannadaName}</p>
          </div>
        </div>

        {/* Mantra */}
        <div className="mt-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 p-4">
          <p className="text-sm leading-relaxed text-stone-700 font-serif italic">
            &ldquo;{guru.mantra}&rdquo;
          </p>
        </div>

        {/* Description */}
        <p className="mt-4 text-sm leading-relaxed text-stone-600 line-clamp-3">
          {guru.description}
        </p>

        {/* Aaradhane Info */}
        {guru.aaradhane && (
          <div className="mt-4 flex items-center gap-2 text-sm text-amber-600">
            <Calendar className="h-4 w-4" />
            <span>{guru.aaradhane.month} {guru.aaradhane.paksha} {guru.aaradhane.tithi}</span>
            <span className="text-stone-400">•</span>
            <span>{guru.aaradhane.duration} day{guru.aaradhane.duration !== 1 ? "s" : ""}</span>
          </div>
        )}

        {/* Expandable Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-4 border-t border-stone-100 pt-4">
                {guru.biography && (
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                      <BookOpen className="h-4 w-4 text-amber-600" />
                      Biography
                    </h4>
                    <p className="mt-2 text-sm text-stone-600">{guru.biography}</p>
                  </div>
                )}
                
                {guru.teachings && guru.teachings.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                      <GraduationCap className="h-4 w-4 text-amber-600" />
                      Key Teachings
                    </h4>
                    <ul className="mt-2 space-y-1">
                      {guru.teachings.map((teaching, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                          <ChevronRight className="h-4 w-4 flex-shrink-0 text-amber-500" />
                          {teaching}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {guru.works && guru.works.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                      <Scroll className="h-4 w-4 text-amber-600" />
                      Notable Works
                    </h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {guru.works.map((work, i) => (
                        <span key={i} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                          {work}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4">
          <button
            onClick={onToggle}
            className="text-sm font-medium text-amber-600 hover:text-amber-700"
          >
            {isExpanded ? "Show less" : "Learn more"}
          </button>
          <ChevronRight className={`h-5 w-5 text-stone-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
        </div>
      </div>
    </motion.div>
  );
}

// Timeline Item Component
function TimelineItem({ 
  guru, 
  index, 
  isExpanded, 
  onToggle 
}: { 
  guru: GuruBiography; 
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative flex gap-6"
    >
      {/* Timeline dot */}
      <div className={`relative z-10 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full text-xl font-bold shadow-lg ${
        guru.importance === "founder"
          ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
          : guru.importance === "major"
          ? "bg-gradient-to-br from-orange-400 to-amber-500 text-white"
          : "bg-gradient-to-br from-stone-400 to-stone-500 text-white"
      }`}>
        {guru.number}
      </div>

      {/* Content */}
      <div className={`flex-1 rounded-2xl border bg-white p-6 transition-all ${
        guru.importance === "founder" 
          ? "border-amber-400" 
          : guru.importance === "major"
          ? "border-orange-200"
          : "border-stone-200"
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-stone-900">{guru.name}</h3>
            <p className="mt-1 font-serif italic text-stone-500">{guru.kannadaName}</p>
          </div>
          {guru.importance !== "minor" && (
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${
              guru.importance === "founder" 
                ? "bg-amber-100 text-amber-800"
                : "bg-orange-100 text-orange-800"
            }`}>
              {guru.importance === "founder" ? "Founder" : "Major"}
            </span>
          )}
        </div>

        <p className="mt-4 text-stone-600">{guru.description}</p>

        {guru.aaradhane && (
          <div className="mt-4 flex items-center gap-2 text-sm text-amber-600">
            <Calendar className="h-4 w-4" />
            <span>Aaradhane: {guru.aaradhane.month} {guru.aaradhane.paksha} {guru.aaradhane.tithi}</span>
          </div>
        )}

        <button
          onClick={onToggle}
          className="mt-4 text-sm font-medium text-amber-600 hover:text-amber-700"
        >
          {isExpanded ? "Show less" : "View details"}
        </button>
      </div>
    </motion.div>
  );
}

// List Item Component
function ListItem({ 
  guru, 
  isExpanded, 
  onToggle 
}: { 
  guru: GuruBiography; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`rounded-xl border bg-white transition-all ${
        guru.importance === "founder" 
          ? "border-amber-400" 
          : guru.importance === "major"
          ? "border-orange-200"
          : "border-stone-200"
      }`}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-4 text-left"
      >
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
          guru.importance === "founder"
            ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
            : guru.importance === "major"
            ? "bg-gradient-to-br from-orange-400 to-amber-500 text-white"
            : "bg-stone-200 text-stone-700"
        }`}>
          {guru.number}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-stone-900 truncate">{guru.name}</h3>
          <p className="text-sm text-stone-500 truncate">{guru.description}</p>
        </div>
        {guru.aaradhane && (
          <div className="hidden text-sm text-amber-600 sm:block">
            {guru.aaradhane.month} {guru.aaradhane.tithi}
          </div>
        )}
        <ChevronRight className={`h-5 w-5 text-stone-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="border-t border-stone-100 p-4"
          >
            <div className="rounded-lg bg-amber-50 p-4">
              <p className="font-serif italic text-stone-700">{guru.mantra}</p>
            </div>
            {guru.biography && (
              <p className="mt-4 text-sm text-stone-600">{guru.biography}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
