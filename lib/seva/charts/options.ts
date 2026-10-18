/**
 * ECharts option builders for the seva dashboard and reports (DESIGN-BOOK 12.5, R5 s4-s5).
 * Pure functions: small pre-bucketed arrays in, a plain option object out. No echarts runtime import here,
 * so these run in unit tests and on the server; `components/charts/EChart.tsx` renders them.
 *
 * Shared rules applied to every option: tooltips `triggerOn: 'mousemove|click'` with `confine: true`,
 * labels at least 13 px, amounts in Indian grouping ('Rs 1,00,000'), `animation: false` under reduced motion,
 * the previous period in neutral dashed grey.
 */
import type { EChartsCoreOption } from "echarts/core";

import { formatRupees } from "@/lib/seva/money";
import type { Period } from "@/lib/seva/time";

import { CHART_PREV_COLOR, FALLBACK_CHART_COLORS } from "./colors";

// Input shapes mirror `DashboardData` in types/seva-reports.ts (A2-3); switch to the shared type in A4-6.
export interface HeroInput {
  buckets: { key: string; label: string; cashPaise: number; upiPaise: number; onlinePaise: number }[];
  prev: { key: string; totalPaise: number }[];
}
export interface ModeInput {
  cashPaise: number;
  upiPaise: number;
  onlinePaise: number;
}
export type RushInput = { dow: number; hour: number; count: number }[];
export type CalendarDaysInput = { date: string; totalPaise: number }[];

export type Opts = { colors: string[]; reducedMotion: boolean };

export const CHART_FONT_SIZE = 14;
const SMALL_FONT_SIZE = 13;
const COUNT_FORMAT = new Intl.NumberFormat("en-IN");
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RUSH_FIRST_HOUR = 5;
const RUSH_LAST_HOUR = 22;

export const MODE_NAMES = { cash: "Cash", upi: "UPI", online: "Online" } as const;
export const PREV_NAME = "Previous period";

/** Amount in paise -> 'Rs 1,00,000' (no paise, for charts). */
export function chartRupees(paise: number): string {
  return formatRupees(Math.round(paise), { decimals: false });
}

/** A whole count with Indian grouping: 100000 -> '1,00,000'. */
export function chartCount(n: number): string {
  return COUNT_FORMAT.format(n);
}

/** ' ▲' when the value rose against the previous period, ' ▼' when it fell, '' when level. */
export function trendArrow(value: number, prev: number): string {
  if (value > prev) return " ▲";
  if (value < prev) return " ▼";
  return "";
}

/** Colour index per payment mode, the same in every chart (gold, green, blue: distinct hues, DESIGN-BOOK 18). */
const MODE_COLOR_INDEX = { cash: 0, upi: 3, online: 2 } as const;

function color(o: Opts, i: number): string {
  return o.colors[i] ?? FALLBACK_CHART_COLORS[i % FALLBACK_CHART_COLORS.length];
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

interface TooltipParam {
  seriesName?: string;
  name?: string;
  value?: unknown;
  marker?: unknown;
  axisValueLabel?: string;
  percent?: number;
  dataIndex?: number;
}

function asParams(p: unknown): TooltipParam[] {
  const list = Array.isArray(p) ? p : [p];
  return list.filter((x): x is TooltipParam => typeof x === "object" && x !== null);
}

/** Picks the number a series point carries (plain value, or the last item of an array value). */
function pointNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (Array.isArray(value)) {
    const last: unknown = value[value.length - 1];
    return typeof last === "number" ? last : null;
  }
  return null;
}

/**
 * Builds a tooltip formatter: a heading (axis label or point name) then 'marker series: value' rows.
 * A single item point (no axis) is labelled `itemLabel` so the heading is not repeated as the row label.
 */
function tooltipFormatter(format: (n: number) => string, suffix = "", itemLabel = "Amount"): (p: unknown) => string {
  return (p: unknown) => {
    const params = asParams(p);
    if (params.length === 0) return "";
    const heading = params[0].axisValueLabel ?? params[0].name ?? "";
    const rows = params.map((x) => {
      const n = pointNumber(x.value);
      const marker = typeof x.marker === "string" ? x.marker : "";
      const label = params.length > 1 || x.axisValueLabel ? x.seriesName ?? "" : itemLabel;
      return `${marker}${escapeHtml(label)}: <b>${n === null ? "-" : format(n) + suffix}</b>`;
    });
    return [heading ? `<b>${escapeHtml(heading)}</b>` : "", ...rows].filter(Boolean).join("<br/>");
  };
}

function base(o: Opts, tooltip: Record<string, unknown>): Record<string, unknown> {
  return {
    animation: !o.reducedMotion,
    color: o.colors.length > 0 ? o.colors : [...FALLBACK_CHART_COLORS],
    textStyle: { fontSize: CHART_FONT_SIZE },
    tooltip: { triggerOn: "mousemove|click", confine: true, textStyle: { fontSize: CHART_FONT_SIZE }, ...tooltip },
  };
}

const LEGEND = { bottom: 0, itemGap: 16, textStyle: { fontSize: CHART_FONT_SIZE } };
const AXIS_LABEL = { fontSize: SMALL_FONT_SIZE };
const AMOUNT_AXIS_LABEL = { fontSize: SMALL_FONT_SIZE, formatter: (v: number) => chartRupees(v) };
const COUNT_AXIS_LABEL = { fontSize: SMALL_FONT_SIZE, formatter: (v: number) => chartCount(v) };

/** Collections hero: cash / UPI / online stacked bars per bucket and a dashed grey previous-period line. */
export function heroOption(d: HeroInput, o: Opts): EChartsCoreOption {
  const prevByKey = new Map(d.prev.map((p) => [p.key, p.totalPaise]));
  const stacked = (name: string, i: number, pick: (b: HeroInput["buckets"][number]) => number) => ({
    name,
    type: "bar",
    stack: "collections",
    barMaxWidth: 40,
    itemStyle: { color: color(o, i) },
    emphasis: { focus: "series" },
    data: d.buckets.map(pick),
  });
  const rows = tooltipFormatter(chartRupees);
  // Rows for each series, then '▲ n% against previous' when there is a previous value to compare with (R5 chart 1).
  const heroTooltip = (p: unknown): string => {
    const params = asParams(p);
    const i = params[0]?.dataIndex;
    const bucket = typeof i === "number" ? d.buckets[i] : undefined;
    const prev = bucket ? prevByKey.get(bucket.key) : undefined;
    if (!bucket || prev === undefined || prev <= 0) return rows(p);
    const total = bucket.cashPaise + bucket.upiPaise + bucket.onlinePaise;
    const change = Math.round(((total - prev) / prev) * 100);
    const arrow = change >= 0 ? "▲" : "▼";
    return `${rows(p)}<br/>${arrow} ${Math.abs(change)}% against previous`;
  };
  return {
    ...base(o, { trigger: "axis", axisPointer: { type: "shadow" }, formatter: heroTooltip }),
    legend: LEGEND,
    grid: { left: 8, right: 8, top: 16, bottom: 48, containLabel: true },
    xAxis: { type: "category", data: d.buckets.map((b) => b.label), axisLabel: AXIS_LABEL },
    yAxis: { type: "value", axisLabel: AMOUNT_AXIS_LABEL },
    series: [
      stacked(MODE_NAMES.cash, MODE_COLOR_INDEX.cash, (b) => b.cashPaise),
      stacked(MODE_NAMES.upi, MODE_COLOR_INDEX.upi, (b) => b.upiPaise),
      stacked(MODE_NAMES.online, MODE_COLOR_INDEX.online, (b) => b.onlinePaise),
      {
        name: PREV_NAME,
        type: "line",
        symbol: "none",
        z: 3,
        lineStyle: { type: "dashed", width: 2, color: CHART_PREV_COLOR },
        itemStyle: { color: CHART_PREV_COLOR },
        data: d.buckets.map((b) => prevByKey.get(b.key) ?? null),
      },
    ],
  };
}

/** Top sevas: one ranked bar series (largest on top); each label carries ▲/▼ against the previous period. */
export function topSevasOption(
  d: { rows: { name: string; value: number; prev: number }[]; metric: "amount" | "count" },
  o: Opts,
): EChartsCoreOption {
  const format = d.metric === "amount" ? chartRupees : chartCount;
  const rows = [...d.rows].sort((a, b) => b.value - a.value).reverse();
  const rowAt = (p: unknown) => {
    const [x] = asParams(p);
    return x && typeof x.dataIndex === "number" ? rows[x.dataIndex] : undefined;
  };
  const tooltip = (p: unknown): string => {
    const r = rowAt(p);
    if (!r) return "";
    const arrow = trendArrow(r.value, r.prev);
    return `<b>${escapeHtml(r.name)}</b><br/>This period: <b>${format(r.value)}${arrow}</b><br/>${PREV_NAME}: ${format(r.prev)}`;
  };
  return {
    ...base(o, { trigger: "item", formatter: tooltip }),
    grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: "value", axisLabel: d.metric === "amount" ? AMOUNT_AXIS_LABEL : COUNT_AXIS_LABEL },
    yAxis: { type: "category", data: rows.map((r) => r.name), axisLabel: { fontSize: SMALL_FONT_SIZE, width: 140, overflow: "truncate" } },
    series: [
      {
        name: "This period",
        type: "bar",
        barMaxWidth: 22,
        itemStyle: { color: color(o, 0) },
        label: {
          show: true,
          position: "right",
          fontSize: SMALL_FONT_SIZE,
          formatter: (p: unknown) => {
            const r = rowAt(p);
            return r ? `${format(r.value)}${trendArrow(r.value, r.prev)}` : "";
          },
        },
        data: rows.map((r) => r.value),
      },
    ],
  };
}

/** Payment mode: a donut for today and week; one 100% stacked bar (shares of the period) for month and year. */
export function modeOption(d: ModeInput, period: Period, o: Opts): EChartsCoreOption {
  const parts = [
    { name: MODE_NAMES.cash, value: d.cashPaise, itemStyle: { color: color(o, MODE_COLOR_INDEX.cash) } },
    { name: MODE_NAMES.upi, value: d.upiPaise, itemStyle: { color: color(o, MODE_COLOR_INDEX.upi) } },
    { name: MODE_NAMES.online, value: d.onlinePaise, itemStyle: { color: color(o, MODE_COLOR_INDEX.online) } },
  ];
  if (period === "today" || period === "week") {
    const pieTooltip = (p: unknown): string => {
      const [x] = asParams(p);
      if (!x) return "";
      const share = typeof x.percent === "number" ? Math.round(x.percent) : 0;
      return `<b>${escapeHtml(x.name ?? "")}</b><br/>Amount: <b>${chartRupees(pointNumber(x.value) ?? 0)}</b><br/>Share: <b>${share}%</b>`;
    };
    // The period total sits in the tiles above; no title component is registered (register.ts), so none here.
    return {
      ...base(o, { trigger: "item", formatter: pieTooltip }),
      legend: LEGEND,
      series: [
        {
          name: "Payment mode",
          type: "pie",
          radius: ["50%", "75%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: true,
          label: { show: true, fontSize: CHART_FONT_SIZE, formatter: "{b}\n{d}%" },
          labelLine: { show: true, length: 8, length2: 8 },
          data: parts,
        },
      ],
    };
  }

  const total = d.cashPaise + d.upiPaise + d.onlinePaise;
  const share = (v: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);
  const amountByName = new Map<string, number>(parts.map((p) => [p.name, p.value]));
  const formatter = (p: unknown) =>
    asParams(p)
      .map((x) => {
        const marker = typeof x.marker === "string" ? x.marker : "";
        const name = x.seriesName ?? "";
        return `${marker}${escapeHtml(name)}: <b>${pointNumber(x.value) ?? 0}%</b> (${chartRupees(amountByName.get(name) ?? 0)})`;
      })
      .join("<br/>");
  return {
    ...base(o, { trigger: "axis", axisPointer: { type: "shadow" }, formatter }),
    legend: LEGEND,
    grid: { left: 8, right: 16, top: 8, bottom: 48, containLabel: true },
    xAxis: { type: "value", min: 0, max: 100, axisLabel: { fontSize: SMALL_FONT_SIZE, formatter: "{value}%" } },
    yAxis: { type: "category", data: [period === "month" ? "This month" : "This year"], axisLabel: AXIS_LABEL },
    series: parts.map((p) => ({
      name: p.name,
      type: "bar",
      stack: "mode",
      barMaxWidth: 48,
      itemStyle: p.itemStyle,
      label: { show: true, fontSize: SMALL_FONT_SIZE, formatter: "{c}%" },
      data: [share(p.value)],
    })),
  };
}

/** Counter rush hours: hour (05-22) x weekday heatmap of receipts. */
export function rushOption(d: RushInput, o: Opts): EChartsCoreOption {
  const hours: string[] = [];
  for (let h = RUSH_FIRST_HOUR; h <= RUSH_LAST_HOUR; h += 1) hours.push(String(h).padStart(2, "0"));
  const cells = d
    .filter((c) => c.hour >= RUSH_FIRST_HOUR && c.hour <= RUSH_LAST_HOUR && c.dow >= 0 && c.dow <= 6)
    .map((c) => [c.hour - RUSH_FIRST_HOUR, c.dow, c.count]);
  const max = Math.max(1, ...d.map((c) => c.count));
  const formatter = (p: unknown) => {
    const [x] = asParams(p);
    if (!x || !Array.isArray(x.value)) return "";
    const [hi, dow, count] = x.value as number[];
    return `<b>${WEEKDAYS[dow] ?? ""} ${hours[hi] ?? ""}:00</b><br/>Receipts: <b>${chartCount(count)}</b>`;
  };
  return {
    ...base(o, { trigger: "item", formatter }),
    grid: { left: 8, right: 8, top: 8, bottom: 56, containLabel: true },
    xAxis: { type: "category", data: hours, splitArea: { show: true }, axisLabel: AXIS_LABEL },
    yAxis: { type: "category", data: WEEKDAYS, splitArea: { show: true }, axisLabel: AXIS_LABEL },
    visualMap: {
      min: 0,
      max,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      textStyle: { fontSize: SMALL_FONT_SIZE },
      inRange: { color: ["rgba(150, 150, 150, 0.08)", color(o, 0), color(o, 4)] },
    },
    series: [
      {
        name: "Receipts",
        type: "heatmap",
        label: { show: false, fontSize: SMALL_FONT_SIZE },
        emphasis: { itemStyle: { borderColor: CHART_PREV_COLOR, borderWidth: 1 } },
        data: cells,
      },
    ],
  };
}

/** Festival peaks: a calendar heatmap of the year's daily totals, festival days outlined. */
export function calendarOption(
  d: { year: number; days: CalendarDaysInput; festivals: string[] },
  o: Opts,
): EChartsCoreOption {
  const max = Math.max(1, ...d.days.map((x) => x.totalPaise));
  const totalByDate = new Map(d.days.map((x) => [x.date, x.totalPaise]));
  const festivalSet = new Set(d.festivals);
  const formatter = (p: unknown) => {
    const [x] = asParams(p);
    if (!x || !Array.isArray(x.value)) return "";
    const date = String(x.value[0]);
    const total = totalByDate.get(date) ?? 0;
    const festival = festivalSet.has(date) ? "<br/>Festival day" : "";
    return `<b>${escapeHtml(date)}</b><br/>${chartRupees(total)}${festival}`;
  };
  return {
    ...base(o, { trigger: "item", formatter }),
    visualMap: {
      min: 0,
      max,
      seriesIndex: 0,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      textStyle: { fontSize: SMALL_FONT_SIZE },
      formatter: (v: number) => chartRupees(v),
      inRange: { color: ["rgba(150, 150, 150, 0.08)", color(o, 0), color(o, 1), color(o, 4)] },
    },
    calendar: {
      range: String(d.year),
      top: 40,
      left: 40,
      right: 16,
      bottom: 56,
      cellSize: ["auto", 16],
      splitLine: { show: false },
      itemStyle: { borderWidth: 2, borderColor: "transparent" },
      yearLabel: { show: false },
      dayLabel: { firstDay: 1, fontSize: SMALL_FONT_SIZE },
      monthLabel: { fontSize: SMALL_FONT_SIZE },
    },
    series: [
      {
        name: "Collections",
        type: "heatmap",
        coordinateSystem: "calendar",
        data: d.days.map((x) => [x.date, x.totalPaise]),
      },
      {
        name: "Festival days",
        type: "heatmap",
        coordinateSystem: "calendar",
        itemStyle: { color: "transparent", borderColor: color(o, 4), borderWidth: 2 },
        data: d.festivals.map((date) => [date, totalByDate.get(date) ?? 0]),
      },
    ],
  };
}

/** Seva share: a treemap of category, then seva, sized by amount (paise). Tap a category to drill in. */
export function treemapOption(
  d: { categories: { name: string; children: { name: string; value: number }[] }[] },
  o: Opts,
): EChartsCoreOption {
  return {
    ...base(o, { trigger: "item", formatter: tooltipFormatter(chartRupees) }),
    series: [
      {
        name: "Seva share",
        type: "treemap",
        roam: false,
        nodeClick: "zoomToNode",
        leafDepth: 1,
        breadcrumb: { show: true, bottom: 0, itemStyle: { textStyle: { fontSize: SMALL_FONT_SIZE } } },
        label: { show: true, fontSize: SMALL_FONT_SIZE },
        upperLabel: { show: true, height: 24, fontSize: SMALL_FONT_SIZE },
        itemStyle: { borderColor: "rgba(255, 255, 255, 0.6)", borderWidth: 1, gapWidth: 2 },
        data: d.categories.map((c, i) => ({
          name: c.name,
          itemStyle: { color: color(o, i % Math.max(1, o.colors.length || FALLBACK_CHART_COLORS.length)) },
          children: c.children.map((s) => ({ name: s.name, value: s.value })),
        })),
      },
    ],
  };
}

/** Festival view: receipts per festival day, this year against the compare year (grey). */
export function festivalBarsOption(
  d: { days: { label: string; thisYear: number; compareYear: number | null }[] },
  o: Opts,
): EChartsCoreOption {
  const hasCompare = d.days.some((x) => x.compareYear !== null);
  const series: Record<string, unknown>[] = [
    {
      name: "This year",
      type: "bar",
      barMaxWidth: 32,
      itemStyle: { color: color(o, 0) },
      label: { show: true, position: "top", fontSize: SMALL_FONT_SIZE, formatter: (p: { value: unknown }) => chartCount(pointNumber(p.value) ?? 0) },
      data: d.days.map((x) => x.thisYear),
    },
  ];
  if (hasCompare) {
    series.push({
      name: "Compare year",
      type: "bar",
      barMaxWidth: 32,
      itemStyle: { color: CHART_PREV_COLOR, opacity: 0.6 },
      data: d.days.map((x) => x.compareYear),
    });
  }
  return {
    ...base(o, { trigger: "axis", axisPointer: { type: "shadow" }, formatter: tooltipFormatter(chartCount) }),
    legend: LEGEND,
    grid: { left: 8, right: 8, top: 24, bottom: 48, containLabel: true },
    xAxis: { type: "category", data: d.days.map((x) => x.label), axisLabel: AXIS_LABEL },
    yAxis: { type: "value", axisLabel: COUNT_AXIS_LABEL },
    series,
  };
}
