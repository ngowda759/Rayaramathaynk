"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Calendar, Star } from "lucide-react";
import FeaturedFestival from "./FeaturedFestival";
import FestivalGrid from "./FestivalGrid";
import { Festival, getFeaturedFestival, MONTH_NAMES } from "@/types/festival";

interface FestivalExperienceProps {
  festivals: Festival[];
}

export default function FestivalExperience({ festivals }: FestivalExperienceProps) {
  const featuredFestival = getFeaturedFestival(festivals);

  // Get major festivals count
  const majorCount = festivals.filter(f => f.isMajor).length;

  return (
    <div className="space-y-12">
      {/* Featured Festival with Countdown */}
      {featuredFestival && (
        <section>
          <FeaturedFestival festival={featuredFestival} />
        </section>
      )}

      {/* Quick Stats */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<Calendar className="h-6 w-6" />}
          value={festivals.length}
          label="Total Festivals"
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={<Star className="h-6 w-6" />}
          value={majorCount}
          label="Major Festivals"
          color="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon={<Sparkles className="h-6 w-6" />}
          value={12}
          label="Months Covered"
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          icon={<Calendar className="h-6 w-6" />}
          value={2026}
          label="Year"
          color="bg-green-50 text-green-600"
        />
      </section>

      {/* All Festivals */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-900">Festival Calendar</h2>
          <p className="mt-2 text-stone-600">
            Browse all {festivals.length} festivals celebrated at Sri Raghavendra Swamy Matha
          </p>
        </div>

        <FestivalGrid festivals={festivals} />
      </section>

      {/* Festival by Season */}
      <section>
        <h2 className="mb-6 text-2xl font-bold text-stone-900">Festivals by Season</h2>
        <SeasonGrid festivals={festivals} />
      </section>
    </div>
  );
}

function StatCard({ 
  icon, 
  value, 
  label, 
  color 
}: { 
  icon: React.ReactNode; 
  value: number; 
  label: string; 
  color: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-stone-900">{value}</div>
        <div className="text-sm text-stone-500">{label}</div>
      </div>
    </div>
  );
}

function SeasonGrid({ festivals }: { festivals: Festival[] }) {
  // Group by season
  const bySeason = festivals.reduce((acc, festival) => {
    const season = festival.season;
    if (!acc[season]) acc[season] = [];
    acc[season].push(festival);
    return acc;
  }, {} as Record<string, Festival[]>);

  const seasonInfo: Record<string, { name: string; color: string; emoji: string }> = {
    monsoon: { name: "Monsoon", color: "from-blue-400 to-cyan-500", emoji: "🌧️" },
    autumn: { name: "Autumn", color: "from-orange-400 to-red-500", emoji: "🍂" },
    winter: { name: "Winter", color: "from-slate-400 to-blue-500", emoji: "❄️" },
    spring: { name: "Spring", color: "from-green-400 to-emerald-500", emoji: "🌸" },
    summer: { name: "Summer", color: "from-yellow-400 to-orange-500", emoji: "☀️" },
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(bySeason).map(([season, seasonFestivals]) => {
        const info = seasonInfo[season] || { name: season, color: "from-stone-400 to-stone-500", emoji: "📅" };
        return (
          <div
            key={season}
            className="overflow-hidden rounded-2xl border border-stone-200 bg-white"
          >
            <div className={`bg-gradient-to-r ${info.color} p-4`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{info.emoji}</span>
                <div>
                  <h3 className="font-bold text-white">{info.name}</h3>
                  <p className="text-sm text-white/80">
                    {seasonFestivals.length} festival{seasonFestivals.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {seasonFestivals.slice(0, 3).map(festival => (
                  <div key={festival.id} className="flex items-center justify-between text-sm">
                    <span className="text-stone-700">{festival.name}</span>
                    <span className="text-stone-400">
                      {new Date(festival.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                ))}
                {seasonFestivals.length > 3 && (
                  <p className="text-sm text-amber-600 font-medium">
                    +{seasonFestivals.length - 3} more
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
