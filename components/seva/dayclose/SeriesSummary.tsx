import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Chip } from "@/components/seva/ui/Chip";
import { DAYCLOSE, gapsLine, seriesLine } from "@/lib/seva/strings/dayclose";
import type { DayClosePrep } from "@/types/seva-dayclose";

/**
 * Close day, step 5 (DB §9.10): per series of the counter (C and OF), the first and last receipt number of the day,
 * how many were issued and cancelled, and the series' open number gaps (DB §8; a gap is critical until resolved).
 */

type SeriesRange = DayClosePrep["seriesRanges"][number];

/** 'C1-023-10-2026/000101 to 000408' when both share everything before the running number. */
export function rangeText(first: string | null, last: string | null): string | null {
  if (!first) return null;
  if (!last || last === first) return first;
  const cut = first.lastIndexOf("/");
  if (cut > 0 && last.startsWith(first.slice(0, cut + 1))) return `${first} to ${last.slice(cut + 1)}`;
  return `${first} to ${last}`;
}

function SeriesRow({ range }: { range: SeriesRange }): JSX.Element {
  const text = rangeText(range.first, range.last);
  const counts = seriesLine({ issued: range.issued, cancelled: range.cancelled });
  const gaps = range.openGaps > 0 ? gapsLine(range.openGaps) : null;
  return (
    <li className="flex flex-col gap-1 border-b border-(--border) pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{range.series}</span>
        {text ? <span className="font-mono text-(length:--text-ui) tabular-nums">{text}</span> : null}
      </div>
      {text ? (
        <Bilingual en={counts.en} kn={counts.kn} className="text-(length:--text-meta) text-(--muted-foreground)" />
      ) : (
        <Bilingual en={DAYCLOSE.noReceipts.en} kn={DAYCLOSE.noReceipts.kn} className="text-(length:--text-meta) text-(--muted-foreground)" />
      )}
      <div>
        {gaps ? (
          <Chip tone="critical">{gaps.en}</Chip>
        ) : (
          <Chip tone="ok">{DAYCLOSE.noGaps.en}</Chip>
        )}
      </div>
    </li>
  );
}

export function SeriesSummary({ ranges }: { ranges: DayClosePrep["seriesRanges"] }): JSX.Element {
  return (
    <section aria-label={DAYCLOSE.numbers.en} className="flex flex-col gap-3 rounded-(--radius-card) border border-(--border) bg-(--card) p-5 shadow-(--shadow-card)">
      <Bilingual as="h2" en={DAYCLOSE.numbers.en} kn={DAYCLOSE.numbers.kn} className="text-(length:--text-h2) font-semibold" />
      <ul className="flex flex-col gap-3" data-testid="dc-series">
        {ranges.map((r) => (
          <SeriesRow key={r.series} range={r} />
        ))}
      </ul>
    </section>
  );
}

export default SeriesSummary;
