"use client";

import React, { useState, useMemo, useEffect } from "react";
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
import { templeAreasService } from "@/services/temple-areas.service";

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
        const data = await templeAreasService.getAreas();
        setAreas(data);
      } catch (error) {
        console.error("Failed to load temple areas:", error);
      } finally {
        setLoading(false);
      }
    }
    loadAreas();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(areas.map(a => a.category));
    return Array.from(cats) as TempleAreaCategory[];
  }, [areas]);

  const filteredAreas = useMemo(() => {
    if (selectedCategory) {
      return areas.filter(a => a.category === selectedCategory);
    }
    return areas;
  }, [areas, selectedCategory]);

  const handleAreaClick = (area: TempleArea) => {
    setSelectedArea(area);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
          <p className="text-stone-500">Loading temple areas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Category Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 font-medium transition-all ${
            selectedCategory === null
              ? "bg-amber-500 text-white shadow-lg"
              : "bg-white text-stone-600 border border-stone-200 hover:border-amber-300"
          }`}
        >
          All Areas
        </button>
        {categories.map(category => {
          const colors = CATEGORY_COLORS[category];
          return (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 font-medium transition-all ${
                selectedCategory === category
                  ? "bg-amber-500 text-white shadow-lg"
                  : "bg-white text-stone-600 border border-stone-200 hover:border-amber-300"
              }`}
            >
              {CATEGORY_ICONS[category]}
              <span className="hidden sm:inline">{CATEGORY_LABELS[category]}</span>
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={<MapPin className="h-5 w-5" />} label="Total Areas" value={areas.length} />
        <StatCard icon={<Sparkles className="h-5 w-5" />} label="Sanctuaries" value={areas.filter(a => a.category === "sanctum").length} />
        <StatCard icon={<Landmark className="h-5 w-5" />} label="Halls" value={areas.filter(a => a.category === "halls").length} />
        <StatCard icon={<Home className="h-5 w-5" />} label="Facilities" value={areas.filter(a => a.category === "facilities").length} />
      </div>

      {/* Content */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Areas List */}
        <div className="lg:col-span-2">
          {/* View Mode Toggle */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-stone-900">
              {selectedCategory ? CATEGORY_LABELS[selectedCategory] : "All Temple Areas"}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-lg p-2 transition-colors ${
                  viewMode === "grid" ? "bg-amber-500 text-white" : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-lg p-2 transition-colors ${
                  viewMode === "list" ? "bg-amber-500 text-white" : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Grid/List View */}
          <div className={viewMode === "grid" ? "grid gap-4 sm:grid-cols-2" : "space-y-3"}>
            {filteredAreas.map((area, index) => (
              <AreaCard
                key={area.id}
                area={area}
                index={index}
                viewMode={viewMode}
                isSelected={selectedArea?.id === area.id}
                onClick={() => handleAreaClick(area)}
              />
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            {selectedArea ? (
              <AreaDetailPanel area={selectedArea} />
            ) : (
              <QuickInfoPanel />
            )}
          </div>
        </div>
      </div>

      {/* Map Toggle */}
      <div className="flex justify-center">
        <button
          onClick={() => setShowMap(!showMap)}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 font-semibold text-white transition-all hover:bg-amber-600 hover:shadow-lg"
        >
          <Navigation className="h-5 w-5" />
          {showMap ? "Hide Map" : "Show Temple Location"}
        </button>
      </div>

      {/* Embedded Map */}
      <AnimatePresence>
        {showMap && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-3xl shadow-2xl"
          >
            <iframe
              src={`https://maps.google.com/maps?q=${TEMPLE_COORDINATES.latitude},${TEMPLE_COORDINATES.longitude}&z=17&output=embed`}
              width="100%"
              height="400"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              className="rounded-3xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
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
      className={`group text-left rounded-2xl border bg-white p-6 transition-all hover:shadow-lg ${
        isSelected ? "border-amber-400 shadow-lg ring-2 ring-amber-200" : "border-stone-200"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-4xl">{area.icon}</span>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors.bg} ${colors.text}`}>
          {CATEGORY_LABELS[area.category]}
        </span>
      </div>
      <h4 className="mt-4 font-semibold text-stone-900 group-hover:text-amber-600 transition-colors">
        {area.name}
      </h4>
      <p className="mt-2 line-clamp-2 text-sm text-stone-600">{area.description}</p>
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
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayTimings = TEMPLE_TIMINGS.find(t => t.day === today);

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
