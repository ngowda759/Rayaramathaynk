"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Sunrise,
  Sunset,
  Moon,
  CalendarDays,
  Sparkles,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Flame,
  Star,
  Coffee,
} from "lucide-react";
import {
  TempleStatus,
  PanchangaSummary,
  DailyQuote,
  PrasadaInfo,
  FeaturedEvent,
  Announcement,
} from "@/types/daily-spiritual";

interface DailySpiritualDashboardProps {
  initialData?: {
    templeStatus: TempleStatus;
    panchanga: PanchangaSummary | null;
    quote: DailyQuote | null;
    prasada: PrasadaInfo;
    featuredEvent: FeaturedEvent | null;
    announcements: Announcement[];
  } | null;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Temple Status Card Widget
 */
function TempleStatusCard({ status }: { status: TempleStatus }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (status.session) {
      case "morning":
        return "from-amber-400 to-orange-500";
      case "evening":
        return "from-sky-400 to-blue-600";
      default:
        return "from-stone-400 to-stone-600";
    }
  };

  const getStatusIcon = () => {
    switch (status.session) {
      case "morning":
        return <Sunrise className="h-8 w-8" />;
      case "evening":
        return <Sunset className="h-8 w-8" />;
      default:
        return <Moon className="h-8 w-8" />;
    }
  };

  const getStatusText = () => {
    if (status.isOpen) {
      return status.session === "morning" ? "Morning Darshan" : "Evening Darshan";
    }
    return "Temple Closed";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white to-amber-50 p-6 shadow-lg ring-1 ring-amber-100"
    >
      <div
        className={`absolute -right-4 -top-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br ${getStatusColor()} opacity-20`}
      >
        {getStatusIcon()}
      </div>

      <div className="relative">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${getStatusColor()} text-white shadow-lg`}
          >
            {getStatusIcon()}
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500">Temple Status</p>
            <h3 className="text-2xl font-bold text-stone-900">{getStatusText()}</h3>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
              Current Time
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-stone-900">
              {formatTime(currentTime)}
            </p>
          </div>

          <div className="h-12 w-px bg-stone-200" />

          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
              {status.session === "morning" ? "Closes" : status.session === "evening" ? "Closes" : "Opens"}
            </p>
            <p className="mt-1 text-lg font-bold text-stone-900">
              {status.nextOpenTime || (status.session === "morning" ? status.morningClose : status.session === "evening" ? status.eveningClose : "-")}
            </p>
          </div>
        </div>

        {status.message && (
          <p className="mt-4 text-center text-sm text-stone-500">{status.message}</p>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Panchanga Summary Widget
 */
function PanchangaSummaryWidget({ panchanga }: { panchanga: PanchangaSummary | null }) {
  const items = panchanga
    ? [
        { label: "Tithi", value: panchanga.tithi, icon: Moon, color: "text-violet-600" },
        { label: "Nakshatra", value: panchanga.nakshatra, icon: Star, color: "text-amber-600" },
        { label: "Sunrise", value: panchanga.sunrise, icon: Sunrise, color: "text-orange-500" },
        { label: "Sunset", value: panchanga.sunset, icon: Sunset, color: "text-sky-600" },
      ]
    : [];

  if (!panchanga) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-3xl bg-gradient-to-br from-white to-stone-50 p-6 shadow-lg ring-1 ring-stone-100"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white">
            <CalendarDays className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-stone-900">Today&apos;s Panchanga</h3>
        </div>
        <p className="text-center text-stone-400">Loading panchanga data...</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-3xl bg-gradient-to-br from-white to-stone-50 p-6 shadow-lg ring-1 ring-stone-100"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white">
            <CalendarDays className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-stone-900">Today&apos;s Panchanga</h3>
        </div>
        {panchanga.isFestival && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600">
            {panchanga.festivalName || "Festival"}
          </span>
        )}
        {panchanga.isEkadashi && (
          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-600">
            {panchanga.ekadashiName || "Ekadashi"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-stone-100"
            >
              <Icon className={`h-4 w-4 ${item.color}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-stone-400">{item.label}</p>
                <p className="truncate font-medium text-stone-900">{item.value || "-"}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

/**
 * Featured Event Widget
 */
function FeaturedEventWidget({ event }: { event: FeaturedEvent | null }) {
  if (!event) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-3xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 shadow-lg ring-1 ring-purple-100"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-stone-900">Today&apos;s Special</h3>
        </div>
        <p className="text-center text-stone-500">No special events today</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 shadow-lg ring-1 ring-purple-100"
    >
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-purple-400/20" />
      <div className="absolute -bottom-4 -left-4 h-24 w-24 rounded-full bg-pink-400/20" />

      <div className="relative">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-stone-900">Today&apos;s Special</h3>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-purple-100">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <span
                className={`mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                  event.isOngoing
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {event.isOngoing ? "Ongoing" : event.daysRemaining === 0 ? "Today" : "Upcoming"}
              </span>
              <h4 className="font-bold text-stone-900">{event.title}</h4>
              <p className="mt-1 text-sm text-stone-500 line-clamp-2">{event.description}</p>
            </div>
          </div>

          {event.daysRemaining !== undefined && event.daysRemaining > 0 && (
            <p className="mt-3 text-center text-sm font-medium text-purple-600">
              {event.daysRemaining} day{event.daysRemaining !== 1 ? "s" : ""} remaining
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Daily Quote Widget
 */
function DailyQuoteWidget({ quote }: { quote: DailyQuote | null }) {
  if (!quote) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-6 shadow-lg ring-1 ring-indigo-100"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 text-white">
          <Star className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-bold text-stone-900">Daily Inspiration</h3>
      </div>

      <blockquote className="relative">
        <p className="text-lg italic text-stone-700">&ldquo;{quote.text}&rdquo;</p>
        <footer className="mt-4 text-right">
          <cite className="text-sm font-medium text-stone-500 not-italic">
            &mdash; {quote.source}
          </cite>
        </footer>
      </blockquote>
    </motion.div>
  );
}

/**
 * Prasada Info Widget
 */
function PrasadaInfoWidget({ prasada }: { prasada: PrasadaInfo }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="rounded-3xl bg-gradient-to-br from-amber-500/10 to-yellow-500/10 p-6 shadow-lg ring-1 ring-amber-100"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-white">
          <Coffee className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-bold text-stone-900">Today&apos;s Prasada</h3>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-amber-100">
        {prasada.available ? (
          <CheckCircle2 className="h-6 w-6 text-green-500" />
        ) : (
          <AlertCircle className="h-6 w-6 text-stone-400" />
        )}
        <div className="flex-1">
          <p className="font-semibold text-stone-900">{prasada.name}</p>
          <p className="text-sm text-stone-500">{prasada.distributionTime}</p>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Announcements Widget
 */
function AnnouncementsWidget({ announcements }: { announcements: Announcement[] }) {
  const [expanded, setExpanded] = useState(false);

  const displayAnnouncements = expanded ? announcements : announcements.slice(0, 2);

  if (announcements.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="rounded-3xl bg-gradient-to-br from-red-500/10 to-orange-500/10 p-6 shadow-lg ring-1 ring-red-100"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-400 to-orange-500 text-white">
          <AlertCircle className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-bold text-stone-900">Announcements</h3>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
          {announcements.length}
        </span>
      </div>

      <div className="space-y-3">
        {displayAnnouncements.map((announcement) => (
          <div
            key={announcement.id}
            className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-stone-100"
          >
            <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
            <div className="flex-1">
              <p className="font-medium text-stone-900">{announcement.title}</p>
              <p className="mt-1 text-sm text-stone-500">{announcement.message}</p>
            </div>
          </div>
        ))}
      </div>

      {announcements.length > 2 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 flex w-full items-center justify-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700"
        >
          {expanded ? "Show less" : `View all ${announcements.length} announcements`}
          <ChevronRight
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </button>
      )}
    </motion.div>
  );
}

/**
 * Main Daily Spiritual Dashboard Component
 */
export default function DailySpiritualDashboard({
  initialData,
}: DailySpiritualDashboardProps) {
  const [data] = useState(initialData);
  const [loading] = useState(!initialData);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <section className="bg-gradient-to-b from-white to-amber-50/50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
              <Flame className="h-4 w-4" />
              Daily Spiritual Dashboard
            </div>
            <h2 className="mt-4 text-3xl font-bold text-stone-900">
              Today&apos;s Spiritual Journey
            </h2>
            <p className="mt-2 text-stone-600">
              {formatDate(currentTime)}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-3xl bg-white p-6 shadow-lg"
              >
                <div className="h-40 rounded-xl bg-stone-200" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <section className="bg-gradient-to-b from-white to-amber-50/50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
            <Flame className="h-4 w-4" />
            Daily Spiritual Dashboard
          </div>
          <h2 className="mt-4 text-3xl font-bold text-stone-900">
            Today&apos;s Spiritual Journey
          </h2>
          <p className="mt-2 text-stone-600">
            {formatDate(currentTime)}
          </p>
        </motion.div>

        {/* Dashboard Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Temple Status */}
          <TempleStatusCard status={data.templeStatus} />

          {/* Panchanga Summary */}
          <PanchangaSummaryWidget panchanga={data.panchanga} />

          {/* Featured Event */}
          <FeaturedEventWidget event={data.featuredEvent} />

          {/* Daily Quote */}
          <DailyQuoteWidget quote={data.quote} />

          {/* Prasada Info */}
          <PrasadaInfoWidget prasada={data.prasada} />
        </div>

        {/* Announcements - Full Width */}
        {data.announcements.length > 0 && (
          <div className="mt-6">
            <AnnouncementsWidget announcements={data.announcements} />
          </div>
        )}
      </div>
    </section>
  );
}
