import {
  calendarOption,
  festivalBarsOption,
  heroOption,
  modeOption,
  rushOption,
  topSevasOption,
  treemapOption,
  type HeroInput,
} from "@/lib/seva/charts/options";

const COLORS = ["rgb(201, 150, 40)", "rgb(180, 100, 50)", "rgb(40, 140, 90)", "rgb(60, 100, 170)", "rgb(160, 40, 50)"];
const OPTS = { colors: COLORS, reducedMotion: false };

type Rec = Record<string, unknown>;

const HERO: HeroInput = {
  buckets: [
    { key: "09", label: "09:00", cashPaise: 10_000_000, upiPaise: 250_000, onlinePaise: 0 },
    { key: "10", label: "10:00", cashPaise: 50_000, upiPaise: 75_000, onlinePaise: 0 },
  ],
  prev: [
    { key: "09", totalPaise: 9_000_000 },
    { key: "10", totalPaise: 100_000 },
  ],
};

function allOptions(reducedMotion: boolean): Rec[] {
  const o = { colors: COLORS, reducedMotion };
  return [
    heroOption(HERO, o),
    topSevasOption({ rows: [{ name: "Kumkumarchane", value: 120_000, prev: 90_000 }], metric: "amount" }, o),
    modeOption({ cashPaise: 100_000, upiPaise: 50_000, onlinePaise: 0 }, "today", o),
    modeOption({ cashPaise: 100_000, upiPaise: 50_000, onlinePaise: 0 }, "year", o),
    rushOption([{ dow: 1, hour: 9, count: 12 }], o),
    calendarOption({ year: 2026, days: [{ date: "2026-10-18", totalPaise: 500_000 }], festivals: ["2026-10-18"] }, o),
    treemapOption({ categories: [{ name: "Pooja", children: [{ name: "Panchamrutha", value: 30_000 }] }] }, o),
    festivalBarsOption({ days: [{ label: "Day 1", thisYear: 400, compareYear: 350 }] }, o),
  ] as unknown as Rec[];
}

function seriesOf(option: Rec): Rec[] {
  const s = option.series;
  return (Array.isArray(s) ? s : [s]) as Rec[];
}

/** Collects every `axisLabel` / `label` object anywhere inside an option. */
function labelObjects(node: unknown, found: Rec[] = []): Rec[] {
  if (Array.isArray(node)) {
    node.forEach((n) => labelObjects(n, found));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Rec)) {
      if ((k === "axisLabel" || k === "label") && v && typeof v === "object") found.push(v as Rec);
      labelObjects(v, found);
    }
  }
  return found;
}

describe("chart option builders", () => {
  it("hero has three stacked bar series and one dashed previous-period line", () => {
    const series = seriesOf(heroOption(HERO, OPTS) as unknown as Rec);
    const bars = series.filter((s) => s.type === "bar");
    expect(bars).toHaveLength(3);
    expect(new Set(bars.map((b) => b.stack)).size).toBe(1);
    expect(bars[0].stack).toBeTruthy();
    const lines = series.filter((s) => s.type === "line");
    expect(lines).toHaveLength(1);
    expect((lines[0].lineStyle as Rec).type).toBe("dashed");
    expect(lines[0].data).toEqual([9_000_000, 100_000]);
  });

  it("tooltips trigger on mousemove and click and stay inside the chart", () => {
    for (const option of allOptions(false)) {
      const tooltip = option.tooltip as Rec;
      expect(tooltip.triggerOn).toBe("mousemove|click");
      expect(tooltip.confine).toBe(true);
    }
  });

  it("labels are at least 13 px", () => {
    for (const option of allOptions(false)) {
      expect((option.textStyle as Rec).fontSize).toBeGreaterThanOrEqual(13);
      for (const label of labelObjects(option)) {
        expect(typeof label.fontSize).toBe("number");
        expect(label.fontSize as number).toBeGreaterThanOrEqual(13);
      }
    }
  });

  it("tooltip amounts use Indian grouping", () => {
    const option = heroOption(HERO, OPTS) as unknown as Rec;
    const formatter = (option.tooltip as Rec).formatter as (p: unknown) => string;
    const out = formatter([
      { seriesName: "Cash", value: 10_000_000, marker: "", axisValueLabel: "09:00" },
      { seriesName: "UPI", value: 250_000, marker: "", axisValueLabel: "09:00" },
    ]);
    expect(out).toContain("Rs 1,00,000");
    expect(out).toContain("Rs 2,500");
  });

  it("turns animation off for reduced motion", () => {
    for (const option of allOptions(true)) expect(option.animation).toBe(false);
    for (const option of allOptions(false)) expect(option.animation).toBe(true);
  });

  it("uses a donut for today and week, 100% bars for month and year", () => {
    const mode = { cashPaise: 300_000, upiPaise: 100_000, onlinePaise: 0 };
    for (const period of ["today", "week"] as const) {
      const series = seriesOf(modeOption(mode, period, OPTS) as unknown as Rec);
      expect(series).toHaveLength(1);
      expect(series[0].type).toBe("pie");
      expect(Array.isArray(series[0].radius)).toBe(true);
    }
    for (const period of ["month", "year"] as const) {
      const option = modeOption(mode, period, OPTS) as unknown as Rec;
      const series = seriesOf(option);
      expect(series.every((s) => s.type === "bar" && s.stack === series[0].stack)).toBe(true);
      expect(series).toHaveLength(3);
      const shares = series.map((s) => (s.data as number[])[0]);
      expect(shares).toEqual([75, 25, 0]);
      expect((option.xAxis as Rec).max).toBe(100);
    }
  });

  it("top sevas has one ranked bar series with an arrow against the previous period", () => {
    const option = topSevasOption(
      {
        rows: [
          { name: "Kumkumarchane", value: 120, prev: 90 },
          { name: "Panchamrutha", value: 50, prev: 80 },
        ],
        metric: "count",
      },
      OPTS,
    ) as unknown as Rec;
    const series = seriesOf(option);
    expect(series).toHaveLength(1);
    const data = series[0].data as number[];
    const label = series[0].label as { formatter: (p: unknown) => string };
    const tooltip = (option.tooltip as Rec).formatter as (p: unknown) => string;
    const idxOf = (value: number) => data.indexOf(value);
    expect(label.formatter({ dataIndex: idxOf(120), value: 120 })).toContain("▲");
    expect(label.formatter({ dataIndex: idxOf(50), value: 50 })).toContain("▼");
    expect(tooltip({ dataIndex: idxOf(50), value: 50 })).toContain("▼");
    expect(tooltip({ dataIndex: idxOf(50), value: 50 })).toContain("80");
  });

  it("donut tooltip shows the amount and the share without repeating the mode name", () => {
    const option = modeOption({ cashPaise: 100_000, upiPaise: 50_000, onlinePaise: 0 }, "today", OPTS) as unknown as Rec;
    const tooltip = (option.tooltip as Rec).formatter as (p: unknown) => string;
    const html = tooltip({ name: "Cash", value: 100_000, percent: 66.7, marker: "" });
    expect(html.match(/Cash/g)).toHaveLength(1);
    expect(html).toContain("Share: <b>67%</b>");
  });

  it("gives each payment mode the same colour in the hero and the donut", () => {
    const hero = seriesOf(heroOption(HERO, OPTS) as unknown as Rec);
    const pie = seriesOf(modeOption({ cashPaise: 1, upiPaise: 1, onlinePaise: 1 }, "today", OPTS) as unknown as Rec)[0];
    const pieColors = (pie.data as { itemStyle: { color: string } }[]).map((x) => x.itemStyle.color);
    const heroColors = hero.slice(0, 3).map((s) => (s.itemStyle as Rec).color);
    expect(heroColors).toEqual(pieColors);
    expect(pieColors).toEqual([COLORS[0], COLORS[3], COLORS[2]]);
  });

  it("hero tooltip adds the % change against the previous period", () => {
    const option = heroOption(HERO, OPTS) as unknown as Rec;
    const tooltip = (option.tooltip as Rec).formatter as (p: unknown) => string;
    const html = tooltip([{ seriesName: "Cash", value: 50_000, marker: "", axisValueLabel: "10:00", dataIndex: 1 }]);
    expect(html).toContain("▲ 25% against previous");
  });
});
