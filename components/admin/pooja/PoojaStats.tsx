"use client";

import { useEffect, useState } from "react";
import { Flame, Clock, CircleDollarSign, CalendarCheck } from "lucide-react";
import StatCard from "@/components/admin/common/StatCard";
import { PoojaStats as PoojaStatsType } from "@/types/pooja";
import { poojaService } from "@/services/pooja.service";

export default function PoojaStats() {
  const [stats, setStats] = useState<PoojaStatsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await poojaService.getStats();
        setStats(data);
      } catch (err) {
        console.error("Failed to load pooja stats:", err);
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
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  const topCategory = Object.entries(stats.byCategory).sort(
    (a, b) => b[1] - a[1]
  )[0];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Poojas"
        value={stats.total}
        icon={Flame}
        description="All daily poojas"
      />
      <StatCard
        title="Active"
        value={stats.active}
        icon={CalendarCheck}
        description="Currently active"
      />
      <StatCard
        title="With Seva"
        value={stats.withSeva}
        icon={CircleDollarSign}
        description="Poojas with seva amount"
      />
      <StatCard
        title="Top Category"
        value={topCategory ? topCategory[1] : 0}
        icon={Clock}
        description={topCategory ? topCategory[0] : "N/A"}
      />
    </div>
  );
}
