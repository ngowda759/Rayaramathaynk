"use client";

import dynamic from "next/dynamic";
import { useMemo, type JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { festivalBarsOption } from "@/lib/seva/charts/options";
import { formatRupees } from "@/lib/seva/money";
import { FESTIVAL, countText } from "@/lib/seva/strings/reports";
import type { FestivalReport } from "@/services/seva/reports.service";

import { changeText, shortDay, useChartOpts } from "./SevaSummary";

const EChart = dynamic(() => import("@/components/charts/EChart"), { ssr: false });

function rupees(paise: number): string {
  return formatRupees(paise, { decimals: paise % 100 !== 0 });
}

/** Receipts per festival day, day by day against the compare year's same day of the festival. */
export function festivalDays(report: FestivalReport): { label: string; thisYear: number; compareYear: number | null }[] {
  const current = [...report.current.perDay].sort((a, b) => a.date.localeCompare(b.date));
  const compare = [...report.compare.perDay].sort((a, b) => a.date.localeCompare(b.date));
  const n = Math.max(current.length, compare.length);
  return Array.from({ length: n }, (_, i) => ({
    label: current[i] ? `${FESTIVAL.dayN(i + 1)} (${shortDay(current[i].date).replace(/ \d{4}$/, "")})` : FESTIVAL.dayN(i + 1),
    thisYear: current[i]?.receipts ?? 0,
    compareYear: compare[i] ? compare[i].receipts : null,
  }));
}

/**
 * Prasadam packets to plan for next year's festival: this year's receipts with prasadam, grown by the change against
 * the compare year (no growth when the compare year has no data). A plain planning line, not a forecast model.
 */
export function prasadamPlan(report: FestivalReport): { year: number; packets: number; receipts: number; growthPct: number | null } {
  const receipts = report.current.prasadamReceipts;
  const before = report.compare.prasadamReceipts;
  const growth = before > 0 ? (receipts - before) / before : null;
  const packets = Math.ceil((receipts * (1 + Math.max(0, growth ?? 0))) / 10) * 10;
  return { year: report.year + 1, packets, receipts, growthPct: growth === null ? null : Math.round(growth * 100) };
}

/** Per seva: quantity this year and in the compare year, and the difference. */
export function festivalSevaRows(report: FestivalReport): { sevaId: string; nameEn: string; nameKn: string | null; now: number; before: number }[] {
  const rows = new Map<string, { sevaId: string; nameEn: string; nameKn: string | null; now: number; before: number }>();
  for (const s of report.current.sevas) rows.set(s.sevaId, { sevaId: s.sevaId, nameEn: s.nameEn, nameKn: s.nameKn, now: s.quantity, before: 0 });
  for (const s of report.compare.sevas) {
    const row = rows.get(s.sevaId) ?? { sevaId: s.sevaId, nameEn: s.nameEn, nameKn: s.nameKn, now: 0, before: 0 };
    row.before = s.quantity;
    rows.set(s.sevaId, row);
  }
  return [...rows.values()].sort((a, b) => b.now - a.now);
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

const th = "px-3 py-2.5 text-left text-(length:--text-meta) font-semibold text-(--muted-foreground)";
const td = "px-3 py-2.5 align-top text-(length:--text-ui) text-(--foreground) tabular-nums";

export interface FestivalViewProps {
  report: FestivalReport;
  asOf: string;
}

/**
 * Festival view (DB §12.4): sevas, amount, prasadam handed over against receipts, receipts per festival day against
 * an earlier year, and a plain planning line for prasadam packets.
 */
export function FestivalView({ report, asOf }: FestivalViewProps): JSX.Element {
  const { opts, ref } = useChartOpts();
  const days = useMemo(() => festivalDays(report), [report]);
  const option = useMemo(() => festivalBarsOption({ days }, opts), [days, opts]);
  const sevaRows = useMemo(() => festivalSevaRows(report), [report]);
  const plan = prasadamPlan(report);
  const nowSevas = sevaRows.reduce((n, r) => n + r.now, 0);
  const beforeSevas = sevaRows.reduce((n, r) => n + r.before, 0);
  const hasCompare = report.compare.receipts > 0;

  return (
    <div ref={ref} className="flex flex-col gap-4" data-testid="festival-view">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile
          label={FESTIVAL.sevas(report.year)}
          value={countText(nowSevas)}
          line={hasCompare ? `${FESTIVAL.vs(countText(beforeSevas))} · ${changeText(nowSevas, beforeSevas)}` : FESTIVAL.noCompare}
        />
        <Tile
          label={FESTIVAL.amount(report.year)}
          value={rupees(report.current.amountPaise)}
          line={
            hasCompare
              ? `${FESTIVAL.vs(rupees(report.compare.amountPaise))} · ${changeText(report.current.amountPaise, report.compare.amountPaise)}`
              : FESTIVAL.noCompare
          }
        />
        <Tile
          label={FESTIVAL.prasadam}
          value={countText(report.current.prasadamGiven)}
          line={FESTIVAL.prasadamLine(report.current.prasadamGiven, report.current.prasadamReceipts)}
        />
      </div>

      {days.length > 0 ? (
        <section className="rounded-(--radius-surface) border border-(--border) bg-(--card) p-4">
          <EChart
            option={option}
            height={280}
            title={{ en: FESTIVAL.perDay.en, kn: FESTIVAL.perDay.kn }}
            asOf={asOf}
            table={{
              caption: `${FESTIVAL.perDay.en}: ${report.festival.nameEn} ${report.year} against ${report.compareYear}`,
              columns: ["Day", String(report.year), String(report.compareYear)],
              rows: days.map((d) => [d.label, d.thisYear, d.compareYear ?? "-"]),
            }}
          />
        </section>
      ) : null}

      <p className="rounded-(--radius-control) border border-(--border) bg-(--attn-soft) px-4 py-3 text-(length:--text-ui) text-(--foreground)">
        {FESTIVAL.planning(plan.year, plan.packets, plan.receipts, plan.growthPct === null ? "" : FESTIVAL.growth(plan.growthPct))}
      </p>

      {sevaRows.length > 0 ? (
        <div className="overflow-x-auto rounded-(--radius-surface) border border-(--border) bg-(--card)">
          <table className="w-full border-collapse">
            <caption className="sr-only">
              {report.festival.nameEn} {report.year} against {report.compareYear}
            </caption>
            <thead className="border-b border-(--border) bg-(--secondary)">
              <tr>
                <th scope="col" className={th}>
                  {FESTIVAL.table.seva}
                </th>
                <th scope="col" className={`${th} text-right`}>
                  {report.festival.nameEn} {report.year}
                </th>
                <th scope="col" className={`${th} text-right`}>
                  {report.festival.nameEn} {report.compareYear}
                </th>
                <th scope="col" className={`${th} text-right`}>
                  {FESTIVAL.table.difference}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--border)">
              {sevaRows.map((r) => (
                <tr key={r.sevaId}>
                  <th scope="row" className={`${td} text-left font-normal`}>
                    <Bilingual en={r.nameEn} kn={r.nameKn} className="font-semibold" />
                  </th>
                  <td className={`${td} text-right`}>{countText(r.now)}</td>
                  <td className={`${td} text-right`}>{hasCompare ? countText(r.before) : "-"}</td>
                  <td className={`${td} text-right`}>{hasCompare ? `${r.now - r.before >= 0 ? "+" : ""}${countText(r.now - r.before)}` : "-"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-(--border)">
              <tr>
                <th scope="row" className={`${td} text-left`}>
                  {FESTIVAL.table.total}
                </th>
                <td className={`${td} text-right font-semibold`}>{countText(nowSevas)}</td>
                <td className={`${td} text-right font-semibold`}>{hasCompare ? countText(beforeSevas) : "-"}</td>
                <td className={`${td} text-right font-semibold`}>
                  {hasCompare ? `${nowSevas - beforeSevas >= 0 ? "+" : ""}${countText(nowSevas - beforeSevas)}` : "-"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default FestivalView;
