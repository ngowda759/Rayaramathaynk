"use client";

/**
 * Thin ECharts client wrapper for the seva dashboard and reports (DESIGN-BOOK 12.5, R5 s4).
 * Pages load it with `next/dynamic(() => import('@/components/charts/EChart'), { ssr: false })`.
 *
 * Renders the English title with Kannada under it, the chart (SVG renderer), an "as of HH:MM" note and a
 * visually hidden table with the same data for screen readers. Re-renders on resize, on a
 * prefers-reduced-motion change (animation off) and on a theme change (chart colours re-read from the tokens).
 */
import { useEffect, useRef, type JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { readChartColors } from "@/lib/seva/charts/colors";
import { echarts, type EChartsCoreOption, type EChartsType } from "@/lib/seva/charts/register";
import { istParts } from "@/lib/seva/time";

export interface EChartProps {
  option: EChartsCoreOption;
  height: number;
  title: { en: string; kn?: string };
  asOf: string;
  table: { caption: string; columns: string[]; rows: (string | number)[][] };
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const DARK_SCHEME = "(prefers-color-scheme: dark)";

/** 'HH:MM' as given, or an ISO time shown as HH:MM in IST. */
export function asOfLabel(asOf: string): string {
  if (/^\d{1,2}:\d{2}$/.test(asOf.trim())) return asOf.trim();
  const d = new Date(asOf);
  if (Number.isNaN(d.getTime())) return asOf;
  const p = istParts(d);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** Deep copy of an option with each colour string in `from` swapped for the colour at the same index in `to`. */
function remapColors(node: unknown, swap: Map<string, string>): unknown {
  if (swap.size === 0) return node;
  if (typeof node === "string") return swap.get(node) ?? node;
  if (Array.isArray(node)) return node.map((n) => remapColors(n, swap));
  if (node && typeof node === "object" && Object.getPrototypeOf(node) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = remapColors(v, swap);
    return out;
  }
  return node;
}

/** Applies `option` with the colours the tokens hold now and the current motion preference. */
function applyOption(box: HTMLElement, chart: EChartsType, option: EChartsCoreOption, baseColors: { current: string[] | null }): void {
  const current = readChartColors(box);
  const base = baseColors.current ?? current;
  baseColors.current = base;
  const swap = new Map<string, string>();
  base.forEach((c, i) => {
    if (current[i] && current[i] !== c) swap.set(c, current[i]);
  });
  const themed = remapColors(option, swap) as EChartsCoreOption;
  chart.setOption(matches(REDUCED_MOTION) ? { ...themed, animation: false } : themed, { notMerge: true });
}

function matches(query: string): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

export default function EChart({ option, height, title, asOf, table }: EChartProps): JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const baseColorsRef = useRef<string[] | null>(null);
  const optionRef = useRef<EChartsCoreOption>(option);

  // Mount: create the chart, watch size, motion and theme; dispose on unmount.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const chart = echarts.init(box, null, { renderer: "svg" });
    chartRef.current = chart;
    applyOption(box, chart, optionRef.current, baseColorsRef);

    const resize = new ResizeObserver(() => chart.resize());
    resize.observe(box);

    const reapply = () => applyOption(box, chart, optionRef.current, baseColorsRef);
    const queries =
      typeof window.matchMedia === "function" ? [window.matchMedia(REDUCED_MOTION), window.matchMedia(DARK_SCHEME)] : [];
    queries.forEach((q) => q.addEventListener("change", reapply));
    const themeObserver = new MutationObserver(reapply);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });

    return () => {
      resize.disconnect();
      queries.forEach((q) => q.removeEventListener("change", reapply));
      themeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // Option changes: re-render with the new data.
  useEffect(() => {
    optionRef.current = option;
    const box = boxRef.current;
    const chart = chartRef.current;
    if (box && chart) applyOption(box, chart, option, baseColorsRef);
  }, [option]);

  return (
    <figure className="flex flex-col gap-2">
      <Bilingual as="h3" en={title.en} kn={title.kn} className="text-base font-semibold" />
      <div ref={boxRef} role="img" aria-label={title.en} className="w-full" style={{ height }} />
      <figcaption className="text-sm text-muted-foreground">as of {asOfLabel(asOf)}</figcaption>
      <table className="sr-only">
        <caption>{table.caption}</caption>
        <thead>
          <tr>
            {table.columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
