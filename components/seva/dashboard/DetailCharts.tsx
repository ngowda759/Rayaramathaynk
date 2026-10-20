"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState, type JSX, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/seva/ui/Segmented";
import type { EChartsCoreOption } from "echarts/core";

import { calendarOption, chartCount, chartRupees, modeOption, rushOption, topSevasOption } from "@/lib/seva/charts/options";
import { DASHBOARD, PERIOD_WORDS, PREVIOUS } from "@/lib/seva/strings/dashboard";
import { istParts, type Period } from "@/lib/seva/time";
import type { DashboardData } from "@/types/seva-reports";

/** ECharts is loaded only on this page, in the browser (DB §12.5). */
const EChart = dynamic(() => import("@/components/charts/EChart"), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-[260px] w-full animate-pulse rounded-[14px] bg-(--secondary)" />,
});

export interface DetailChartsProps {
  data: DashboardData;
  period: Period;
  colors: string[];
  reducedMotion: boolean;
  /**
   * Fetches the This year answer. Festival peaks is a heatmap of every day of the year (DB §12.1 item 5), but the
   * answer for Today, Week or Month holds only that span's days and festivals, so the tap asks for the year (the
   * route's 60-second cache keeps it cheap). Not called on This year, whose answer already has every day.
   */
  loadYear: () => Promise<DashboardData>;
}

type Metric = "amount" | "count";

/** The year answer behind the Festival peaks tap, for the periods other than This year. */
type YearLoad =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: DashboardData }
  | { kind: "error"; message: string };

const TOP_SEVAS_SHOWN = 8;
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Card({ id, children }: { id: string; children: ReactNode }): JSX.Element {
  return (
    <section
      data-section={id}
      className="flex min-w-0 flex-col gap-2 rounded-[18px] border border-(--border) bg-(--card) p-4 shadow-(--shadow-card) sm:p-5"
    >
      {children}
    </section>
  );
}

/** The calendar year (IST) of an answer's "as of" time. */
function yearOf(asOf: string): number {
  const d = new Date(asOf);
  return istParts(Number.isNaN(d.getTime()) ? new Date() : d).year;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * The details under the hero chart (DB §12.1 item 5, charts 3-6): Top sevas (amount or count, arrow against the
 * previous period), Payment mode (donut for Today and Week, 100% bars for Month and Year), Counter rush hours, and
 * Festival peaks - on the first screen for This year, one tap deeper otherwise. Each chart has a hidden data table.
 */
export function DetailCharts({ data, period, colors, reducedMotion, loadYear }: DetailChartsProps): JSX.Element {
  const [metric, setMetric] = useState<Metric>("amount");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [yearLoad, setYearLoad] = useState<YearLoad>({ kind: "idle" });
  const yearRequest = useRef(0);
  const opts = useMemo(() => ({ colors, reducedMotion }), [colors, reducedMotion]);
  const when = PERIOD_WORDS[period].when.toLowerCase();
  const prevName = PREVIOUS[period].short;
  const year = yearOf(data.asOf);

  /** Asks for the year answer; only the latest request may set the state. */
  const fetchYear = useCallback(() => {
    yearRequest.current += 1;
    const request = yearRequest.current;
    setYearLoad({ kind: "loading" });
    loadYear().then(
      (yearData) => {
        if (request === yearRequest.current) setYearLoad({ kind: "ready", data: yearData });
      },
      (error: unknown) => {
        if (request !== yearRequest.current) return;
        const message = error instanceof Error && error.message ? error.message : DASHBOARD.calendarFailed.en;
        setYearLoad({ kind: "error", message });
      },
    );
  }, [loadYear]);

  const toggleCalendar = useCallback(() => {
    if (calendarOpen) {
      setCalendarOpen(false);
      return;
    }
    setCalendarOpen(true);
    // Each opening asks again, so the year shown is never older than the route's 60-second cache.
    if (period !== "year") fetchYear();
  }, [calendarOpen, fetchYear, period]);

  const top = useMemo(() => data.topSevas.slice(0, TOP_SEVAS_SHOWN), [data.topSevas]);
  const topOption = useMemo((): EChartsCoreOption => {
    if (metric === "amount") {
      return topSevasOption({ metric, rows: top.map((s) => ({ name: s.nameEn, value: s.amountPaise, prev: s.prevAmountPaise })) }, opts);
    }
    // The dashboard answer has no previous-period quantity, so the count view carries no arrow and its tooltip shows
    // the count alone (no "previous" figure that would only repeat this one).
    const rows = top.map((s) => ({ name: s.nameEn, value: s.quantity, prev: s.quantity }));
    const option = topSevasOption({ metric, rows }, opts);
    const ranked = [...rows].sort((a, b) => b.value - a.value).reverse();
    const tooltip = (option.tooltip ?? {}) as Record<string, unknown>;
    return {
      ...option,
      tooltip: {
        ...tooltip,
        formatter: (p: unknown) => {
          const i = (Array.isArray(p) ? p[0] : p) as { dataIndex?: unknown } | undefined;
          const r = typeof i?.dataIndex === "number" ? ranked[i.dataIndex] : undefined;
          return r ? `<b>${escapeHtml(r.name)}</b><br/>Count: <b>${chartCount(r.value)}</b>` : "";
        },
      },
    };
  }, [metric, top, opts]);

  const modeOpt = useMemo(() => modeOption(data.mode, period, opts), [data.mode, period, opts]);
  // The server counts weekdays ISO style (1 = Monday ... 7 = Sunday); the chart rows run Sunday (0) to Saturday (6).
  const rush = useMemo(() => data.rush.map((c) => ({ dow: c.dow % 7, hour: c.hour, count: c.count })), [data.rush]);
  const rushOpt = useMemo(() => rushOption(rush, opts), [rush, opts]);
  const showCalendar = period === "year" || calendarOpen;
  // This year's answer holds every day of the year; the other periods show the year answer fetched on the tap.
  const calData: DashboardData | null = period === "year" ? data : yearLoad.kind === "ready" ? yearLoad.data : null;
  const calYear = calData ? yearOf(calData.asOf) : year;
  const calOpt = useMemo(
    () => (calData ? calendarOption({ year: calYear, days: calData.calendar, festivals: calData.festivalDates }, opts) : null),
    [calData, calYear, opts],
  );

  const modeTotal = data.mode.cashPaise + data.mode.upiPaise + data.mode.onlinePaise;
  const share = (v: number) => (modeTotal > 0 ? `${Math.round((v / modeTotal) * 100)}%` : "0%");
  const festivalSet = new Set(calData?.festivalDates ?? []);

  const festivalHeading = (
    <h3 className="text-base font-semibold">
      {DASHBOARD.festivalPeaks.en}
      <span className="kn" lang="kn">
        {DASHBOARD.festivalPeaks.kn}
      </span>
    </h3>
  );

  let calendarBody: ReactNode = festivalHeading;
  if (showCalendar && calData && calOpt) {
    calendarBody = (
      <EChart
        option={calOpt}
        height={240}
        title={DASHBOARD.festivalPeaks}
        asOf={calData.asOf}
        table={{
          caption: `${DASHBOARD.festivalPeaks.en}, ${calYear}`,
          columns: [DASHBOARD.date, DASHBOARD.amount, DASHBOARD.festivalDay],
          rows: calData.calendar.map((d) => [d.date, chartRupees(d.totalPaise), festivalSet.has(d.date) ? "Yes" : "No"]),
        }}
      />
    );
  } else if (showCalendar && yearLoad.kind === "error") {
    calendarBody = (
      <>
        {festivalHeading}
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[14px] border border-(--border) bg-(--secondary) p-3">
          <p className="meta">{yearLoad.message}</p>
          <Button variant="seva-secondary" size="sm" onClick={fetchYear}>
            {DASHBOARD.tryAgain}
          </Button>
        </div>
      </>
    );
  } else if (showCalendar) {
    calendarBody = (
      <>
        {festivalHeading}
        <div
          role="status"
          aria-live="polite"
          className="flex h-[240px] w-full items-center justify-center rounded-[14px] bg-(--secondary)"
        >
          <span className="meta text-(--muted-foreground)">{DASHBOARD.calendarLoading(year)}</span>
        </div>
      </>
    );
  }

  const festival = (
    <Card id="festival-peaks">
      {calendarBody}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="meta text-(--muted-foreground)">{DASHBOARD.festivalNote}</p>
        {period !== "year" ? (
          <Button
            variant="seva-secondary"
            size="sm"
            aria-expanded={calendarOpen}
            onClick={toggleCalendar}
          >
            {calendarOpen ? DASHBOARD.hideCalendar(year) : DASHBOARD.showCalendar(year)}
          </Button>
        ) : null}
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-4">
      {period === "year" ? festival : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card id="top-sevas">
          <div className="flex justify-end">
            <Segmented<Metric>
              name="top-metric"
              label={DASHBOARD.rankBy}
              value={metric}
              onChange={setMetric}
              options={[
                { value: "amount", en: DASHBOARD.byAmount.en },
                { value: "count", en: DASHBOARD.byCount.en },
              ]}
            />
          </div>
          <EChart
            option={topOption}
            height={Math.max(200, top.length * 40 + 40)}
            title={DASHBOARD.topSevas}
            asOf={data.asOf}
            table={{
              caption: `${DASHBOARD.topSevas.en}, ${when}`,
              columns: [DASHBOARD.seva, DASHBOARD.amount, DASHBOARD.count, `Amount ${prevName}`],
              rows: top.map((s) => [s.nameKn ? `${s.nameEn} (${s.nameKn})` : s.nameEn, chartRupees(s.amountPaise), chartCount(s.quantity), chartRupees(s.prevAmountPaise)]),
            }}
          />
          {top.length === 0 ? <p className="meta text-(--muted-foreground)">{DASHBOARD.noReceipts.en}</p> : null}
          {metric === "amount" && top.length > 0 ? (
            <p className="meta text-(--muted-foreground)">▲ more than {prevName} · ▼ less</p>
          ) : null}
        </Card>
        <Card id="payment-mode">
          <EChart
            option={modeOpt}
            height={260}
            title={DASHBOARD.paymentMode}
            asOf={data.asOf}
            table={{
              caption: `${DASHBOARD.paymentMode.en}, ${when}`,
              columns: [DASHBOARD.mode, DASHBOARD.amount, DASHBOARD.share],
              rows: [
                [DASHBOARD.cash.en, chartRupees(data.mode.cashPaise), share(data.mode.cashPaise)],
                [DASHBOARD.upi.en, chartRupees(data.mode.upiPaise), share(data.mode.upiPaise)],
                [DASHBOARD.online.en, chartRupees(data.mode.onlinePaise), share(data.mode.onlinePaise)],
              ],
            }}
          />
          <p className="meta text-(--muted-foreground)">{DASHBOARD.modeNote}</p>
        </Card>
      </div>
      <Card id="rush-hours">
        <EChart
          option={rushOpt}
          height={300}
          title={DASHBOARD.rush}
          asOf={data.asOf}
          table={{
            caption: `${DASHBOARD.rush.en}, ${when}`,
            columns: [DASHBOARD.weekday, DASHBOARD.hour, DASHBOARD.receiptsCol],
            rows: rush
              .filter((c) => c.count > 0)
              .map((c) => [WEEKDAY_NAMES[c.dow] ?? "", `${String(c.hour).padStart(2, "0")}:00`, chartCount(c.count)]),
          }}
        />
        <p className="meta text-(--muted-foreground)">{DASHBOARD.rushNote}</p>
      </Card>
      {period === "year" ? null : festival}
    </div>
  );
}

export default DetailCharts;
