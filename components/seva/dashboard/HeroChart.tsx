"use client";

import dynamic from "next/dynamic";
import { useMemo, type JSX } from "react";

import { chartRupees, heroOption, PREV_NAME } from "@/lib/seva/charts/options";
import { DASHBOARD, PERIOD_WORDS, PREVIOUS } from "@/lib/seva/strings/dashboard";
import type { Period } from "@/lib/seva/time";
import type { DashboardData } from "@/types/seva-reports";

/** ECharts is loaded only on this page, in the browser (DB §12.5). */
const EChart = dynamic(() => import("@/components/charts/EChart"), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-[320px] w-full animate-pulse rounded-[14px] bg-(--secondary)" />,
});

export interface HeroChartProps {
  data: DashboardData;
  period: Period;
  colors: string[];
  reducedMotion: boolean;
}

/**
 * Collections / ಸಂಗ್ರಹ (DB §12.1 item 4, chart 1): cash, UPI and online stacked per bucket by issue time, the
 * like-for-like previous period as a dashed grey ghost line, with a hidden data table for screen readers.
 */
export function HeroChart({ data, period, colors, reducedMotion }: HeroChartProps): JSX.Element {
  const option = useMemo(
    () => heroOption({ buckets: data.hero.buckets, prev: data.hero.prev }, { colors, reducedMotion }),
    [data.hero, colors, reducedMotion],
  );

  const prevByKey = useMemo(() => new Map(data.hero.prev.map((p) => [p.key, p.totalPaise])), [data.hero.prev]);
  const busiest = useMemo(() => {
    let best: { label: string; total: number } | null = null;
    for (const b of data.hero.buckets) {
      const total = b.cashPaise + b.upiPaise + b.onlinePaise;
      if (total > 0 && (!best || total > best.total)) best = { label: b.label, total };
    }
    return best;
  }, [data.hero.buckets]);

  const words = PERIOD_WORDS[period];
  const prevName = PREVIOUS[period].name;

  return (
    <section
      data-section="collections"
      className="flex flex-col gap-2 rounded-[18px] border border-(--border) bg-(--card) p-4 shadow-(--shadow-card) sm:p-5"
    >
      <EChart
        option={option}
        height={320}
        title={DASHBOARD.collections}
        asOf={data.asOf}
        table={{
          caption: `${DASHBOARD.collections.en}, ${words.when.toLowerCase()}`,
          columns: [DASHBOARD.when, DASHBOARD.cash.en, DASHBOARD.upi.en, DASHBOARD.online.en, `${PREV_NAME} (${prevName.toLowerCase()})`],
          rows: data.hero.buckets.map((b) => {
            const prev = prevByKey.get(b.key);
            return [b.label, chartRupees(b.cashPaise), chartRupees(b.upiPaise), chartRupees(b.onlinePaise), prev === undefined ? "-" : chartRupees(prev)];
          }),
        }}
      />
      <p className="meta text-(--muted-foreground)">
        {words.by} · dashed line: {prevName.toLowerCase()}
        {busiest ? ` · Busiest: ${busiest.label}, ${chartRupees(busiest.total)}` : ""}
      </p>
    </section>
  );
}

export default HeroChart;
