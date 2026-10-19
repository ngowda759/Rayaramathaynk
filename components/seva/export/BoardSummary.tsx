"use client";

import { useEffect, useState, useSyncExternalStore, type JSX, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { FALLBACK_CHART_COLORS } from "@/lib/seva/charts/colors";
import { MODE_NAMES, PREV_NAME, heroOption } from "@/lib/seva/charts/options";
import type { BoardAttentionItem, CollectionsChartData, RangeTotals } from "@/lib/seva/export/collect";
import { formatRupees } from "@/lib/seva/money";
import type { Bi } from "@/lib/seva/strings/common";
import { ATTENTION_LABELS, BOARD, changeLine, moreLine, preparedLine } from "@/lib/seva/strings/export";
import { businessDate, formatSevaDate } from "@/lib/seva/time";
import type { DayCloseListRow, SevaSummaryReport } from "@/services/seva/reports.service";
import type { ExportReceiptRow } from "@/types/seva-export";

/**
 * The board print summary (DB §12.6, C-42): a print-styled A4 page in two sheets, large type, black on white.
 * Sheet 1: totals with the change against the previous period, the Collections chart and the needs-attention lines.
 * Sheet 2: the seva table with last year, day-close differences, cancellations and changed amounts with reasons, and
 * rate changes. Each sheet ends with the range, who prepared it and when, and the blessing. Lists are cut to fit the
 * two pages with an "and n more" line (the Excel export has every row).
 *
 * On screen the sheets show as a preview; for print a copy is placed directly under <body> and everything else on
 * the page is hidden, the same way the slip print root works. The A4 page rule lives in the <style> this component
 * renders, so it applies only while the summary is open (the module's print.css sets the slip page for every other
 * print).
 */

export interface BoardSummaryModel {
  templeNameEn: string;
  templeNameKn: string;
  blessing: string;
  range: { from: string; to: string };
  preparedBy: string;
  /** ISO time. */
  preparedAt: string;
  totals: RangeTotals;
  prevTotals: RangeTotals;
  chart: CollectionsChartData;
  attention: BoardAttentionItem[];
  sevas: SevaSummaryReport["sevas"];
  sevaTotals: SevaSummaryReport["totals"];
  rateChanges: SevaSummaryReport["rateChanges"];
  /** Day closes with a cash or UPI difference. */
  dayCloses: DayCloseListRow[];
  cancelledChanged: ExportReceiptRow[];
}

/** How many rows of each list fit on sheet 2 with the large type. */
export const BOARD_LIMITS = { sevas: 10, dayCloses: 4, cancelledChanged: 5, rateChanges: 4 } as const;

const CHART_WIDTH = 680;
const CHART_HEIGHT = 250;

const PRINT_CSS = `
.board-print { display: none; }
@page board-a4 { size: A4 portrait; margin: 12mm; }
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  body:has(> .board-print) > :not(.board-print) { display: none !important; }
  .board-print { display: block; }
  .board-print .board-sheet { page: board-a4; break-after: page; }
  .board-print .board-sheet:last-child { break-after: auto; }
}
`;

/** Whole rupees when there are no paise, else two decimals. */
function rupees(paise: number): string {
  return formatRupees(paise, { decimals: paise % 100 !== 0 });
}

function istStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .replace(/\b(am|pm)\b/, (m) => m.toUpperCase());
}

function rangeText(range: { from: string; to: string }): string {
  return range.from === range.to ? formatSevaDate(range.from) : `${formatSevaDate(range.from)} to ${formatSevaDate(range.to)}`;
}

/** The Collections chart as an SVG data URL, drawn once with ECharts' server-side SVG mode (no live canvas). */
function useChartUrl(chart: CollectionsChartData): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { echarts } = await import("@/lib/seva/charts/register");
        const instance = echarts.init(null, null, { renderer: "svg", ssr: true, width: CHART_WIDTH, height: CHART_HEIGHT });
        instance.setOption(heroOption(chart, { colors: [...FALLBACK_CHART_COLORS], reducedMotion: true }));
        const svg = instance.renderToSVGString();
        instance.dispose();
        if (alive) setUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      } catch {
        if (alive) setUrl(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [chart]);
  return url;
}

function Heading({ text }: { text: Bi }): JSX.Element {
  return (
    <Bilingual
      as="h2"
      en={text.en}
      kn={text.kn}
      className="mt-[5mm] border-b-[0.5mm] border-solid border-black pb-[1mm] text-[14pt] leading-tight font-bold"
    />
  );
}

function More({ total, shown }: { total: number; shown: number }): JSX.Element | null {
  if (total <= shown) return null;
  const line = moreLine(total - shown);
  return <p className="mt-[1mm] text-[10.5pt] italic">{line.en}</p>;
}

function Footer({ model, page }: { model: BoardSummaryModel; page: number }): JSX.Element {
  const line = preparedLine({ range: rangeText(model.range), by: model.preparedBy, at: istStamp(model.preparedAt) });
  return (
    <footer className="mt-auto flex items-end justify-between gap-[4mm] border-t-[0.3mm] border-solid border-black pt-[2mm] text-[10pt]">
      <div>
        <div>{line.en}</div>
        <div className="mt-[0.5mm] text-[12pt] font-bold" lang="kn">
          {model.blessing}
        </div>
      </div>
      <div className="whitespace-nowrap">
        {BOARD.page.en} {page} / 2
      </div>
    </footer>
  );
}

function Sheet({ children, page }: { children: ReactNode; page: number }): JSX.Element {
  return (
    <section
      className="board-sheet box-border flex h-[273mm] w-[186mm] flex-col overflow-hidden bg-white text-[12pt] leading-snug text-black"
      data-testid={`board-sheet-${page}`}
      aria-label={`${BOARD.page.en} ${page}`}
    >
      {children}
    </section>
  );
}

function Tile({ label, value, sub }: { label: Bi; value: string; sub?: Bi }): JSX.Element {
  return (
    <div className="flex flex-col gap-[1mm] border-[0.4mm] border-solid border-black p-[3mm]">
      <Bilingual en={label.en} kn={label.kn} className="text-[11pt]" />
      <span className="text-[20pt] leading-tight font-bold tabular-nums">{value}</span>
      {sub ? <span className="text-[10pt]">{sub.en}</span> : null}
    </div>
  );
}

function SheetOne({ model, chartUrl }: { model: BoardSummaryModel; chartUrl: string | null }): JSX.Element {
  const t = model.totals;
  const p = model.prevTotals;
  return (
    <Sheet page={1}>
      <header className="text-center">
        <div className="text-[16pt] font-bold">{model.templeNameEn}</div>
        {model.templeNameKn ? (
          <div className="text-[14pt] font-bold" lang="kn">
            {model.templeNameKn}
          </div>
        ) : null}
        <Bilingual as="h1" en={BOARD.title.en} kn={BOARD.title.kn} className="mt-[2mm] text-[15pt] font-bold" />
        <div className="mt-[1mm] text-[13pt]">{rangeText(model.range)}</div>
      </header>

      <div className="mt-[5mm] grid grid-cols-2 gap-[3mm]">
        <Tile label={BOARD.totalCollected} value={rupees(t.totalPaise)} sub={changeLine(t.totalPaise, p.totalPaise)} />
        <Tile label={BOARD.receipts} value={String(t.issued)} sub={changeLine(t.issued, p.issued)} />
      </div>
      <div className="mt-[3mm] grid grid-cols-3 gap-[3mm]">
        <Tile label={BOARD.cash} value={rupees(t.cashPaise)} />
        <Tile label={BOARD.upi} value={rupees(t.upiPaise)} />
        <Tile label={BOARD.online} value={rupees(t.onlinePaise)} />
      </div>

      <Heading text={BOARD.collections} />
      <div className="mt-[2mm] h-[70mm]">
        {chartUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a generated SVG data URL; next/image adds nothing here
          <img
            src={chartUrl}
            alt={`${BOARD.collections.en}: ${MODE_NAMES.cash}, ${MODE_NAMES.upi} and ${MODE_NAMES.online} by ${
              model.chart.buckets.length > 0 && model.chart.buckets[0].key.startsWith("m") ? "month" : "day"
            }, with the ${PREV_NAME.toLowerCase()} as a dashed line`}
            className="h-full w-full object-contain"
            data-testid="board-chart"
          />
        ) : null}
      </div>

      <Heading text={BOARD.attention} />
      <ul className="mt-[2mm] flex flex-col gap-[1.5mm]">
        {model.attention.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-[4mm]">
            <Bilingual en={ATTENTION_LABELS[item.id].en} kn={ATTENTION_LABELS[item.id].kn} />
            <span className={item.level === "ok" ? "tabular-nums" : "font-bold tabular-nums"}>
              {item.count}
              {item.level === "critical" ? " !" : ""}
            </span>
          </li>
        ))}
      </ul>

      <Footer model={model} page={1} />
    </Sheet>
  );
}

const cell = "border-b-[0.2mm] border-solid border-black py-[1mm] pr-[2mm] align-top";
const num = `${cell} text-right tabular-nums`;

function SheetTwo({ model }: { model: BoardSummaryModel }): JSX.Element {
  const sevas = [...model.sevas].sort((a, b) => b.amountPaise - a.amountPaise);
  const shownSevas = sevas.slice(0, BOARD_LIMITS.sevas);
  const dayCloses = model.dayCloses.slice(0, BOARD_LIMITS.dayCloses);
  const cancelled = model.cancelledChanged.slice(0, BOARD_LIMITS.cancelledChanged);
  const rates = model.rateChanges.slice(0, BOARD_LIMITS.rateChanges);

  return (
    <Sheet page={2}>
      <Heading text={BOARD.sevas} />
      {sevas.length === 0 ? (
        <p className="mt-[1mm]">{BOARD.noSevas.en}</p>
      ) : (
        <table className="mt-[1mm] w-full border-collapse text-[11pt]">
          <thead>
            <tr className="text-left">
              <th className={cell}>{BOARD.seva.en}</th>
              <th className={num}>{BOARD.count.en}</th>
              <th className={num}>{BOARD.amount.en}</th>
              <th className={num}>
                {BOARD.lastYear.en} ({BOARD.count.en.toLowerCase()})
              </th>
              <th className={num}>
                {BOARD.lastYear.en} ({BOARD.amount.en.toLowerCase()})
              </th>
            </tr>
          </thead>
          <tbody>
            {shownSevas.map((s) => (
              <tr key={s.sevaId}>
                <td className={cell}>{s.nameEn}</td>
                <td className={num}>{s.quantity}</td>
                <td className={num}>{rupees(s.amountPaise)}</td>
                <td className={num}>{s.lastYear.receipts > 0 ? s.lastYear.quantity : "-"}</td>
                <td className={num}>{s.lastYear.receipts > 0 ? rupees(s.lastYear.amountPaise) : "-"}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className={cell}>{BOARD.totalCollected.en}</td>
              <td className={num}>{model.sevaTotals.receipts}</td>
              <td className={num}>{rupees(model.sevaTotals.amountPaise)}</td>
              <td className={num}>{model.sevaTotals.lastYearReceipts > 0 ? model.sevaTotals.lastYearReceipts : "-"}</td>
              <td className={num}>{model.sevaTotals.lastYearReceipts > 0 ? rupees(model.sevaTotals.lastYearAmountPaise) : "-"}</td>
            </tr>
          </tbody>
        </table>
      )}
      <More total={sevas.length} shown={shownSevas.length} />

      <Heading text={BOARD.dayCloses} />
      {dayCloses.length === 0 ? (
        <p className="mt-[1mm]">{BOARD.noDayCloseDifferences.en}</p>
      ) : (
        <table className="mt-[1mm] w-full border-collapse text-[11pt]">
          <tbody>
            {dayCloses.map((d) => (
              <tr key={d.id}>
                <td className={cell}>{formatSevaDate(d.businessDate)}</td>
                <td className={cell}>{d.counterName ?? `Counter ${d.counterId}`}</td>
                <td className={cell}>{d.badge === "short" ? BOARD.short.en : BOARD.extra.en}</td>
                <td className={num}>
                  {BOARD.cash.en} {rupees(d.cashDifferencePaise)}, {BOARD.upi.en} {rupees(d.upiDifferencePaise)}
                </td>
                <td className={cell}>{d.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <More total={model.dayCloses.length} shown={dayCloses.length} />

      <Heading text={BOARD.cancelledChanged} />
      {cancelled.length === 0 ? (
        <p className="mt-[1mm]">{BOARD.noCancelledChanged.en}</p>
      ) : (
        <table className="mt-[1mm] w-full border-collapse text-[11pt]">
          <tbody>
            {cancelled.map((r) => (
              <tr key={r.receiptNo}>
                <td className={`${cell} whitespace-nowrap`}>{r.receiptNo}</td>
                <td className={cell}>{r.status === "cancelled" ? BOARD.cancelled.en : BOARD.changed.en}</td>
                <td className={num}>{rupees(r.amountPaise)}</td>
                <td className={cell}>{r.cancelReason || r.sevas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <More total={model.cancelledChanged.length} shown={cancelled.length} />

      <Heading text={BOARD.rateChanges} />
      {rates.length === 0 ? (
        <p className="mt-[1mm]">{BOARD.noRateChanges.en}</p>
      ) : (
        <table className="mt-[1mm] w-full border-collapse text-[11pt]">
          <tbody>
            {rates.map((c) => (
              <tr key={`${c.sevaId}-${c.changedAt}`}>
                <td className={cell}>{c.nameEn}</td>
                <td className={`${num} whitespace-nowrap`}>
                  {c.oldPaise === null ? "-" : rupees(c.oldPaise)} {"->"} {rupees(c.newPaise)}
                </td>
                <td className={cell}>{formatSevaDate(businessDate(new Date(c.changedAt)))}</td>
                <td className={cell}>{c.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <More total={model.rateChanges.length} shown={rates.length} />

      <Footer model={model} page={2} />
    </Sheet>
  );
}

function Sheets({ model, chartUrl }: { model: BoardSummaryModel; chartUrl: string | null }): JSX.Element {
  return (
    <>
      <SheetOne model={model} chartUrl={chartUrl} />
      <SheetTwo model={model} />
    </>
  );
}

const subscribe = (): (() => void) => () => undefined;

export function BoardSummary({ model }: { model: BoardSummaryModel }): JSX.Element {
  const chartUrl = useChartUrl(model.chart);
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="flex flex-col items-center gap-6 overflow-x-auto pb-6" data-testid="board-preview">
        {[0, 1].map((i) => (
          <div key={i} className="box-content shrink-0 bg-white p-[12mm] shadow-(--shadow-raise)">
            {i === 0 ? <SheetOne model={model} chartUrl={chartUrl} /> : <SheetTwo model={model} />}
          </div>
        ))}
      </div>
      {isClient
        ? createPortal(
            <div className="board-print" data-testid="board-print">
              <Sheets model={model} chartUrl={chartUrl} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export default BoardSummary;
