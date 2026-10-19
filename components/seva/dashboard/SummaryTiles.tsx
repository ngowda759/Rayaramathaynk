import Link from "next/link";
import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { changeLabel, changeTrend } from "@/lib/seva/dashboard/format";
import { formatRupees } from "@/lib/seva/money";
import type { Bi } from "@/lib/seva/strings/common";
import { DASHBOARD, PREVIOUS } from "@/lib/seva/strings/dashboard";
import type { Period } from "@/lib/seva/time";
import type { DashboardData, DashboardTotals } from "@/types/seva-reports";

export interface SummaryTilesProps {
  tiles: DashboardData["tiles"];
  period: Period;
}

interface TileSpec {
  id: string;
  label: Bi;
  value: (t: DashboardTotals) => number;
  money: boolean;
  href: string;
}

const TILES: TileSpec[] = [
  { id: "total", label: DASHBOARD.total, value: (t) => t.totalPaise, money: true, href: "/admin/receipts/reports" },
  { id: "receipts", label: DASHBOARD.receipts, value: (t) => t.receipts, money: false, href: "/admin/receipts/register" },
  { id: "cash", label: DASHBOARD.cash, value: (t) => t.cashPaise, money: true, href: "/admin/receipts/day-closes" },
  { id: "upi", label: DASHBOARD.upi, value: (t) => t.upiPaise, money: true, href: "/admin/receipts/day-closes" },
];

function show(value: number, money: boolean): string {
  return money ? formatRupees(value, { decimals: false }) : value.toLocaleString("en-IN");
}

const TREND_CLASS = {
  up: "bg-(--ok-soft) text-(--ok)",
  down: "bg-(--secondary) text-(--foreground)",
  level: "bg-(--secondary) text-(--foreground)",
  none: "bg-(--secondary) text-(--muted-foreground)",
} as const;

const TREND_ARROW = { up: "▲ ", down: "▼ ", level: "", none: "" } as const;

/**
 * Summary tiles (DB §12.1 item 3): Total collected, Receipts, Cash and UPI, each with the change against the
 * like-for-like previous period ('+12%', '-5%' or 'no data'), and a quiet Online tile that starts in Phase 2.
 */
export function SummaryTiles({ tiles, period }: SummaryTilesProps): JSX.Element {
  const prevWords = PREVIOUS[period];
  return (
    <section aria-label={DASHBOARD.summary} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((t) => {
          const now = t.value(tiles);
          const prev = tiles.prev ? t.value(tiles.prev) : null;
          const label = changeLabel(now, prev);
          const trend = changeTrend(label);
          return (
            <Link
              key={t.id}
              href={t.href}
              data-testid={`tile-${t.id}`}
              className="flex min-w-0 flex-col gap-1.5 rounded-[18px] border border-(--border) bg-(--card) p-4 text-(--foreground) no-underline shadow-(--shadow-card) hover:border-(--border-strong)"
            >
              <Bilingual as="span" en={t.label.en} kn={t.label.kn} className="text-(length:--text-ui) font-semibold" />
              <span className="num text-[clamp(22px,2vw+12px,30px)] leading-tight font-bold tabular-nums">{show(now, t.money)}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-(length:--text-meta)">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${TREND_CLASS[trend]}`}>
                  {TREND_ARROW[trend]}
                  {label}
                </span>
                <span className="text-(--muted-foreground)">
                  vs {prevWords.short}
                  {prev !== null && prev > 0 ? ` · ${show(prev, t.money)}` : ""}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
      <p data-testid="tile-online" className="meta text-(--muted-foreground)">
        {DASHBOARD.online.en} {formatRupees(tiles.onlinePaise, { decimals: false })} · {DASHBOARD.onlineLater}
      </p>
    </section>
  );
}

export default SummaryTiles;
