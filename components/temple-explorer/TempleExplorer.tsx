"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MapPin, Clock, Info, Navigation, Filter, 
  Grid, List, ChevronRight, Phone, Calendar,
  Users, Home, Sparkles, Trees, Landmark, Loader2
} from "lucide-react";
import Link from "next/link";
import {
  TempleArea,
  TempleAreaCategory,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  TEMPLE_COORDINATES,
  TEMPLE_TIMINGS,
  EVENING_TIMINGS,
} from "@/types/temple-explorer";

interface TempleExplorerProps {
  initialCategory?: TempleAreaCategory | null;
}

const CATEGORY_ICONS: Record<TempleAreaCategory, React.ReactNode> = {
  sanctum: <Sparkles className="h-5 w-5" />,
  halls: <Landmark className="h-5 w-5" />,
  facilities: <Home className="h-5 w-5" />,
  gardens: <Trees className="h-5 w-5" />,
  historical: <Landmark className="h-5 w-5" />,
};

export default function TempleExplorer({ initialCategory = null }: TempleExplorerProps) {
  const [selectedCategory, setSelectedCategory] = useState<TempleAreaCategory | null>(initialCategory);
  const [selectedArea, setSelectedArea] = useState<TempleArea | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showMap, setShowMap] = useState(false);
  const [areas, setAreas] = useState<TempleArea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAreas() {
      try {
        const response = await fetch('/api/temple-areas');
        const data = await response.json();
        if (Array.isArray(data)) {
          setAreas(data);
        } else {
            console.error("Invalid response format:", data);
        }
      } catch (error) {
        console.error("Failed to load temple areas:", error);
      } finally {
        setLoading(false);
      }
    }
    loadAreas();
  }, []);

  const filteredAreas = React.useMemo(() => {
    return areas.filter(area => !selectedCategory || area.category === selectedCategory);
  }, [areas, selectedCategory]);

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      {/* Sidebar / Filters */}
      <div className="w-full space-y-6 lg:w-80 lg:shrink-0">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Filter className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-stone-900">Categories</h3>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm transition-all ${
                selectedCategory === null
                  ? "bg-amber-600 text-white shadow-md"
                  : "hover:bg-amber-50 text-stone-600 hover:text-amber-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5" />
                <span className="font-medium">All Areas</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                selectedCategory === null ? "bg-amber-500 text-white" : "bg-stone-100 text-stone-500"
              }`}>
                {areas.length}
              </span>
            </button>

            {(Object.entries(CATEGORY_LABELS) as [TempleAreaCategory, string][]).map(([key, label]) => {
              const count = areas.filter(a => a.category === key).length;
              if (count === 0) return null;

              const isSelected = selectedCategory === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm transition-all ${
                    isSelected
                      ? "bg-amber-600 text-white shadow-md"
                      : "hover:bg-amber-50 text-stone-600 hover:text-amber-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {CATEGORY_ICONS[key]}
                    <span className="font-medium">{label}</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    isSelected ? "bg-amber-500 text-white" : "bg-stone-100 text-stone-500"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <QuickInfoPanel />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Controls */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-stone-900">
              {selectedCategory ? CATEGORY_LABELS[selectedCategory] : "All Temple Areas"}
            </h2>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-600">
              {filteredAreas.length} results
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMap(!showMap)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                showMap ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              <Navigation className="h-4 w-4" />
              {showMap ? "Hide Map" : "Show Map"}
            </button>
            <div className="h-8 w-px bg-stone-200 mx-2" />
            <div className="flex rounded-lg bg-stone-100 p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "grid" ? "bg-white text-amber-600 shadow-sm" : "text-stone-500 hover:text-stone-700"
                }`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "list" ? "bg-white text-amber-600 shadow-sm" : "text-stone-500 hover:text-stone-700"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Map View */}
        <AnimatePresence>
          {showMap && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-8 overflow-hidden rounded-3xl border border-stone-200 shadow-lg"
            >
              <iframe
                src={`https://maps.google.com/maps?q=${TEMPLE_COORDINATES.latitude},${TEMPLE_COORDINATES.longitude}&z=17&output=embed`}
                width="100%"
                height="400"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                className="bg-stone-100"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
        ) : (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* Grid/List */}
            <div className={`flex-1 ${
                viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
                : "flex flex-col gap-3"
            }`}>
                {filteredAreas.map((area, index) => (
                <AreaCard
                    key={area.id}
                    area={area}
                    index={index}
                    viewMode={viewMode}
                    isSelected={selectedArea?.id === area.id}
                    onClick={() => setSelectedArea(area)}
                />
                ))}
            </div>

            {/* Desktop Detail Panel */}
            <div className="hidden lg:block w-[400px] shrink-0 sticky top-24">
                <AnimatePresence mode="wait">
                {selectedArea ? (
                    <AreaDetailPanel key={selectedArea.id} area={selectedArea} />
                ) : (
                    <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex h-[600px] flex-col items-center justify-center rounded-3xl border border-dashed border-stone-300 bg-stone-50/50 p-8 text-center"
                    >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm mb-4">
                        <MapPin className="h-8 w-8 text-stone-300" />
                    </div>
                    <h3 className="text-lg font-medium text-stone-900">Select an Area</h3>
                    <p className="mt-2 text-sm text-stone-500">
                        Click on any temple area to view detailed information, timings, and visitor guidelines.
                    </p>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>
            </div>
        )}

        {/* Mobile Detail Panel (Modal) */}
        {selectedArea && (
          <div className="lg:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 pt-20 backdrop-blur-sm" onClick={() => setSelectedArea(null)}>
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl bg-white shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between bg-white/80 p-4 backdrop-blur-md border-b border-stone-100">
                <h3 className="font-semibold text-stone-900">Area Details</h3>
                <button
                  onClick={() => setSelectedArea(null)}
                  className="rounded-full p-2 text-stone-500 hover:bg-stone-100 transition-colors"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <AreaDetailPanel area={selectedArea} />
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
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

// Area Card Component
function AreaCard({ 
  area, 
  index, 
  viewMode, 
  isSelected, 
  onClick 
}: { 
  area: TempleArea; 
  index: number;
  viewMode: "grid" | "list";
  isSelected: boolean;
  onClick: () => void;
}) {
  const colors = CATEGORY_COLORS[area.category];

  if (viewMode === "list") {
    return (
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03 }}
        onClick={onClick}
        className={`flex w-full items-center gap-4 rounded-xl border bg-white p-4 text-left transition-all hover:shadow-md ${
          isSelected ? "border-amber-400 shadow-lg ring-2 ring-amber-200" : "border-stone-200"
        }`}
      >
        <span className="text-3xl">{area.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-stone-900 truncate">{area.name}</h4>
          <p className="text-sm text-stone-500 truncate">{area.description}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors.bg} ${colors.text}`}>
          {CATEGORY_LABELS[area.category]}
        </span>
        <ChevronRight className="h-5 w-5 text-stone-400" />
      </motion.button>
    );
  }

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={`group text-left rounded-2xl border bg-white p-6 transition-all hover:shadow-lg flex flex-col h-full ${
        isSelected ? "border-amber-400 shadow-lg ring-2 ring-amber-200" : "border-stone-200"
      }`}
    >
      <div className="flex items-start justify-between w-full">
        <span className="text-4xl">{area.icon}</span>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors.bg} ${colors.text}`}>
          {CATEGORY_LABELS[area.category]}
        </span>
      </div>
      <h4 className="mt-4 font-semibold text-stone-900 group-hover:text-amber-600 transition-colors">
        {area.name}
      </h4>
      <p className="mt-2 line-clamp-2 text-sm text-stone-600 flex-1">{area.description}</p>
      {area.bestTimeToVisit && (
        <div className="mt-4 flex items-center gap-2 text-sm text-amber-600">
          <Clock className="h-4 w-4" />
          {area.bestTimeToVisit}
        </div>
      )}
    </motion.button>
  );
}

// Area Detail Panel
function AreaDetailPanel({ area }: { area: TempleArea }) {
  const colors = CATEGORY_COLORS[area.category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg"
    >
      {/* Header */}
      <div className={`bg-gradient-to-r ${colors.bg} p-6`}>
        <div className="flex items-center gap-3">
          <span className="text-5xl">{area.icon}</span>
          <div>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors.bg} ${colors.text}`}>
              {CATEGORY_LABELS[area.category]}
            </span>
            <h3 className="mt-2 text-xl font-bold text-stone-900">{area.name}</h3>
            {area.nameKannada && (
              <p className="mt-1 font-serif text-lg italic text-stone-600">{area.nameKannada}</p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        <p className="text-stone-600">{area.description}</p>

        {area.significance && (
          <div className="rounded-xl bg-amber-50 p-4">
            <h4 className="flex items-center gap-2 font-semibold text-amber-800">
              <Sparkles className="h-4 w-4" />
              Significance
            </h4>
            <p className="mt-2 text-sm text-amber-700">{area.significance}</p>
          </div>
        )}

        {area.features && area.features.length > 0 && (
          <div>
            <h4 className="flex items-center gap-2 font-semibold text-stone-900">
              <Info className="h-4 w-4 text-amber-500" />
              Key Features
            </h4>
            <ul className="mt-3 space-y-2">
              {area.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-amber-500 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {area.bestTimeToVisit && (
          <div className="flex items-center gap-3 rounded-xl bg-stone-50 p-4">
            <Clock className="h-5 w-5 text-stone-500" />
            <div>
              <p className="text-sm font-medium text-stone-900">Best Time to Visit</p>
              <p className="text-sm text-stone-600">{area.bestTimeToVisit}</p>
            </div>
          </div>
        )}

        {area.tips && area.tips.length > 0 && (
          <div>
            <h4 className="flex items-center gap-2 font-semibold text-stone-900">
              <Navigation className="h-4 w-4 text-green-500" />
              Visitor Tips
            </h4>
            <ul className="mt-3 space-y-2">
              {area.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-600">
                    {i + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Quick Info Panel
function QuickInfoPanel() {
  const [today, setToday] = useState<string>("");
  const [todayTimings, setTodayTimings] = useState<any>(null);

  useEffect(() => {
    const day = new Date().toLocaleDateString("en-US", { weekday: "long" });
    setToday(day);
    setTodayTimings(TEMPLE_TIMINGS.find(t => t.day === day));
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
        <h3 className="text-xl font-bold">Temple Information</h3>
        <p className="mt-2 text-amber-100">Plan your visit</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Today's Timings */}
        <div className="rounded-xl bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-amber-600" />
            <h4 className="font-semibold text-stone-900">Today&apos;s Schedule</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">Morning</span>
              <span className="font-medium text-stone-900">
                {todayTimings?.openTime || "5:30 AM"} - {todayTimings?.closeTime || "12:00 PM"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">Evening</span>
              <span className="font-medium text-stone-900">
                {EVENING_TIMINGS.openTime} - {EVENING_TIMINGS.closeTime}
              </span>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-stone-900">Location</h4>
            <p className="mt-1 text-sm text-stone-600">{TEMPLE_COORDINATES.address}</p>
          </div>
        </div>

        {/* Contact */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-stone-900">Contact</h4>
            <p className="mt-1 text-sm text-stone-600">{TEMPLE_COORDINATES.phone}</p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="space-y-2">
          <Link
            href="/pooja"
            className="flex items-center justify-between rounded-xl border border-stone-200 p-3 text-sm font-medium text-stone-700 transition-colors hover:bg-amber-50"
          >
            Book a Pooja
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/facilities"
            className="flex items-center justify-between rounded-xl border border-stone-200 p-3 text-sm font-medium text-stone-700 transition-colors hover:bg-amber-50"
          >
            View All Facilities
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
