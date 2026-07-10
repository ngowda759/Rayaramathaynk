"use client";

import { useEffect, useState } from "react";
import { BookOpen, Calendar, History, Sparkles } from "lucide-react";

import StatCard from "@/components/admin/common/StatCard";
import { AaradhaneStats as AaradhaneStatsType } from "@/types/aaradhane";
import { aaradhaneService } from "@/services/aaradhane.service";

export default function AaradhaneStats() {
  const [stats, setStats] = useState<AaradhaneStatsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await aaradhaneService.getStats();
        setStats(data);
      } catch (err) {
        console.error("Failed to load aaradhane stats:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border bg-muted"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Aaradhanes"
        value={stats.total}
        icon={BookOpen}
        description="All aaradhane records"
      />

      <StatCard
        title="Upcoming"
        value={stats.upcoming}
        icon={Calendar}
        description="Upcoming events"
      />

      <StatCard
        title="Past"
        value={stats.past}
        icon={History}
        description="Past events"
      />

      <StatCard
        title="Next Event"
        value={stats.upcoming > 0 ? "Yes" : "None"}
        icon={Sparkles}
        description="Scheduled"
      />
    </div>
  );
}
