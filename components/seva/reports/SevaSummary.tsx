"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState, type JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { FALLBACK_CHART_COLORS, readChartColors } from "@/lib/seva/charts/colors";
import { chartRupees, treemapOption, type Opts } from "@/lib/seva/charts/options";
import { formatRupees } from "@/lib/seva/money";
import { REPORTS, SUMMARY, countText, type SummaryRange } from "@/lib/seva/strings/reports";
import { addDays, businessDate, formatSevaDate } from "@/lib/seva/time";
import type { SevaSummaryReport } from "@/services/seva/reports.service";

const EChart = dynamic(() => import("@/components/charts/EChart"), { ssr: false });

/**
 * Chart options from the module's colour tokens and the reduced-motion preference, read when the element given to
 * `ref` reaches the page (inside the `.seva` wrapper, where the tokens live). Shared by the seva summary and the
 * festival view; EChart itself re-reads the colours on a theme change.
 */
export function useChartOpts(): { opts: Opts; ref: (el: HTMLElement | null) => void } {
  const [opts, setOpts] = useState<Opts>({ colors: [...FALLBACK_CHART_COLORS], reducedMotion: false });
  const ref = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setOpts({ colors: readChartColors(el), reducedMotion });
  }, []);
  return { opts, ref };
}

/** The IST date span of a range choice on the seva summary; `custom` keeps the dates typed in. */
export function summaryRange(range: Exclude<SummaryRange, "custom">, today: string): { from: string; to: string } {
  const monthStart = `${today.slice(0, 8)}01`;
  if (range === "today") return { from: today, to: today };
  if (range === "month") return { from: monthStart, to: today };
  if (range === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  const lastMonthEnd = addDays(monthStart, -1);
  return { from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd };
}

/** 'Rs 820' for whole rupees, 'Rs 610.50' otherwise. */
function rupees(paise: number): string {
  return formatRupees(paise, { decimals: paise % 100 !== 0 });
}

/** '+12%' / '-6%' against last year, or 'no data' when last year is empty (the first year, DB §5.1 item 12). */
export function changeText(now: number, prev: number): string {
  if (prev <= 0) return REPORTS.noData;
  const pct = Math.round(((now - prev) / prev) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

/** '16 Oct 2026' (no weekday), in IST, from a date or a timestamp. */
export function shortDay(dateOrIso: string): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dateOrIso) ? dateOrIso : businessDate(new Date(dateOrIso));
  return formatSevaDate(day).replace(/^\S+ /, "");
}

/** "Rate Rs 150 -> Rs 200 from 16 Oct 2026" for each rate change of the seva in the range. */
export function rateChangeLines(report: SevaSummaryReport, sevaId: string): string[] {
  return report.rateChanges
    .filter((r) => r.sevaId === sevaId)
    .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
    .map((r) => SUMMARY.rateChange(r.oldPaise === null ? null : rupees(r.oldPaise), rupees(r.newPaise), shortDay(r.changedAt)));
}

/** Category, then seva, sized by amount: the treemap "Where the money comes from". */
export function shareTree(report: SevaSummaryReport): { categories: { name: string; children: { name: string; value: number }[] }[] } {
  const byCategory = new Map<string, { name: string; value: number }[]>();
  for (const s of report.sevas) {
    if (s.amountPaise <= 0) continue;
    const category = s.category?.trim() || SUMMARY.otherCategory;
    const list = byCategory.get(category) ?? [];
    list.push({ name: s.nameEn, value: s.amountPaise });
    byCategory.set(category, list);
  }
  return {
    categories: [...byCategory.entries()]
      .map(([name, children]) => ({ name, children: children.sort((a, b) => b.value - a.value) }))
      .sort((a, b) => b.children.reduce((n, c) => n + c.value, 0) - a.children.reduce((n, c) => n + c.value, 0)),
  };
}

function Tile({ label, value, line }: { label: { en: string; kn: string }; value: string; line: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-1 rounded-(--radius-surface) border border-(--border) bg-(--card) p-4">
      <Bilingual en={label.en} kn={label.kn} className="text-(length:--text-meta) font-semibold text-(--muted-foreground)" />
      <span className="text-(length:--text-h2) font-semibold text-(--foreground) tabular-nums">{value}</span>
      <span className="text-(length:--text-meta) text-(--muted-foreground)">{line}</span>
    </div>
  );
}

export interface SevaSummaryProps {
  report: SevaSummaryReport;
  /** When the report was read, for the chart's "as of" note. */
  asOf: string;
}

const th = "px-3 py-2.5 text-left text-(length:--text-meta) font-semibold text-(--muted-foreground)";
const td = "px-3 py-2.5 align-top text-(length:--text-ui) text-(--foreground) tabular-nums";

/**
 * Seva summary (DB §12.4): count and amount per seva against the same days last year, counted by seva date (C-63),
 * with rate changes under the seva name and the treemap "Where the money comes from / ಸೇವಾ ಪಾಲು".
 */
export function SevaSummary({ report, asOf }: SevaSummaryProps): JSX.Element {
  const { opts, ref } = useChartOpts();
  const tree = useMemo(() => shareTree(report), [report]);
  const option = useMemo(() => treemapOption(tree, opts), [tree, opts]);
  const quantity = report.sevas.reduce((n, s) => n + s.quantity, 0);
  const lastYearQuantity = report.sevas.reduce((n, s) => n + s.lastYear.quantity, 0);
  const lastFrom = shortDay(report.lastYearFrom);
  const lastTo = shortDay(report.lastYearTo);
  const rows = [...report.sevas].sort((a, b) => b.amountPaise - a.amountPaise);

  if (report.sevas.length === 0) {
    return (
      <div className="py-8 text-center">
        <Bilingual en={SUMMARY.empty.en} kn={SUMMARY.empty.kn} className="text-(--muted-foreground)" />
      </div>
    );
  }

  return (
    <div ref={ref} className="flex flex-col gap-4" data-testid="seva-summary">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile
          label={SUMMARY.amount}
          value={rupees(report.totals.amountPaise)}
          line={`${SUMMARY.lastYear(lastFrom, lastTo, report.totals.lastYearAmountPaise > 0 ? rupees(report.totals.lastYearAmountPaise) : REPORTS.noData)} · ${changeText(report.totals.amountPaise, report.totals.lastYearAmountPaise)}`}
        />
        <Tile
          label={SUMMARY.sevasPerformed}
          value={countText(quantity)}
          line={SUMMARY.lastYear(lastFrom, lastTo, lastYearQuantity > 0 ? countText(lastYearQuantity) : REPORTS.noData)}
        />
        <Tile
          label={SUMMARY.receipts}
          value={countText(report.totals.receipts)}
          line={SUMMARY.lastYear(lastFrom, lastTo, report.totals.lastYearReceipts > 0 ? countText(report.totals.lastYearReceipts) : REPORTS.noData)}
        />
      </div>

      {tree.categories.length > 0 ? (
        <section className="rounded-(--radius-surface) border border-(--border) bg-(--card) p-4">
          <EChart
            option={option}
            height={320}
            title={{ en: SUMMARY.share.en, kn: SUMMARY.share.kn }}
            asOf={asOf}
            table={{
              caption: `${SUMMARY.share.en}, ${shortDay(report.from)} - ${shortDay(report.to)}`,
              columns: ["Category", "Seva", "Amount"],
              rows: tree.categories.flatMap((c) => c.children.map((s) => [c.name, s.name, chartRupees(s.value)])),
            }}
          />
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-(--radius-surface) border border-(--border) bg-(--card)">
        <table className="w-full border-collapse">
          <caption className="sr-only">
            {SUMMARY.heading.en}, {shortDay(report.from)} - {shortDay(report.to)}
          </caption>
          <thead className="border-b border-(--border) bg-(--secondary)">
            <tr>
              <th scope="col" className={th}>
                {SUMMARY.table.seva}
              </th>
              <th scope="col" className={`${th} text-right`}>
                {SUMMARY.table.count}
              </th>
              <th scope="col" className={`${th} text-right`}>
                {SUMMARY.table.amount}
              </th>
              <th scope="col" className={`${th} text-right`}>
                {SUMMARY.table.countLastYear}
              </th>
              <th scope="col" className={`${th} text-right`}>
                {SUMMARY.table.amountLastYear}
              </th>
              <th scope="col" className={`${th} text-right`}>
                {SUMMARY.table.change}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--border)">
            {rows.map((s) => (
              <tr key={s.sevaId}>
                <th scope="row" className={`${td} text-left font-normal`}>
                  <Bilingual en={s.nameEn} kn={s.nameKn} className="font-semibold" />
                  {rateChangeLines(report, s.sevaId).map((line) => (
                    <span key={line} className="block text-(length:--text-meta) text-(--muted-foreground)">
                      {line}
                    </span>
                  ))}
                </th>
                <td className={`${td} text-right`}>{countText(s.quantity)}</td>
                <td className={`${td} text-right`}>{rupees(s.amountPaise)}</td>
                <td className={`${td} text-right`}>{s.lastYear.quantity > 0 ? countText(s.lastYear.quantity) : REPORTS.noData}</td>
                <td className={`${td} text-right`}>{s.lastYear.amountPaise > 0 ? rupees(s.lastYear.amountPaise) : REPORTS.noData}</td>
                <td className={`${td} text-right`}>{changeText(s.amountPaise, s.lastYear.amountPaise)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-(--border)">
            <tr>
              <th scope="row" className={`${td} text-left`}>
                {SUMMARY.table.total}
              </th>
              <td className={`${td} text-right font-semibold`}>{countText(quantity)}</td>
              <td className={`${td} text-right font-semibold`}>{rupees(report.totals.amountPaise)}</td>
              <td className={`${td} text-right font-semibold`}>{lastYearQuantity > 0 ? countText(lastYearQuantity) : REPORTS.noData}</td>
              <td className={`${td} text-right font-semibold`}>
                {report.totals.lastYearAmountPaise > 0 ? rupees(report.totals.lastYearAmountPaise) : REPORTS.noData}
              </td>
              <td className={`${td} text-right font-semibold`}>{changeText(report.totals.amountPaise, report.totals.lastYearAmountPaise)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <Bilingual as="div" en={SUMMARY.bySevaDate.en} kn={SUMMARY.bySevaDate.kn} className="text-(length:--text-meta) text-(--muted-foreground)" />
    </div>
  );
}

export default SevaSummary;
