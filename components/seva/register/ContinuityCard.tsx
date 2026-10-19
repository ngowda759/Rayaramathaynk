"use client";

import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Chip, type ChipTone } from "@/components/seva/ui/Chip";
import { Button } from "@/components/ui/button";
import { CONTINUITY } from "@/lib/seva/strings/reports";
import type { ContinuityGap, ContinuityRow } from "@/types/seva-reports";

/**
 * Number continuity card of the receipts register (DB §12.3, §8.5): one line per series for the chosen range, e.g.
 * "C1 Counter 1 online, C1-023-10-2026/000101 - 000227, 127 numbers, 125 issued, 2 cancelled, Continuous". An open
 * gap is critical and offers Resolve to people who may resolve gaps; W (website and app) starts in Phase 2.
 */

export type ContinuityState = "continuous" | "open_gap" | "missing";

/** Open gaps first; then numbers between the first and last that the register does not hold; else continuous. */
export function continuityState(row: ContinuityRow): ContinuityState {
  if (row.openGaps > 0) return "open_gap";
  if (row.numbers > row.issued + row.cancelled) return "missing";
  return "continuous";
}

/** The running part of a receipt number: 'C1-023-10-2026/000124' -> '000124'. */
function runningPart(receiptNo: string): string {
  const slash = receiptNo.lastIndexOf("/");
  return slash === -1 ? receiptNo : receiptNo.slice(slash + 1);
}

function prefixOf(receiptNo: string): string {
  const slash = receiptNo.lastIndexOf("/");
  return slash === -1 ? "" : receiptNo.slice(0, slash);
}

/** 'C1-023-10-2026/000101 - 000227'; the last number in full when its series, staff or month part differs. */
function rangeText(first: string, last: string): string {
  if (first === last) return first;
  return prefixOf(first) === prefixOf(last) ? `${first} - ${runningPart(last)}` : `${first} - ${last}`;
}

/** Offline series start with 'OF'; every other counter series is the online one. */
function seriesName(row: ContinuityRow): string {
  const kind = row.series.startsWith("OF") ? CONTINUITY.offline : CONTINUITY.online;
  return row.counterName ? `${row.counterName} ${kind}` : kind;
}

function stateText(row: ContinuityRow): string {
  const state = continuityState(row);
  if (state === "open_gap") return CONTINUITY.openGap(row.openGaps);
  if (state === "missing") return CONTINUITY.missing(row.numbers - row.issued - row.cancelled);
  return CONTINUITY.continuous;
}

/** The whole line for one series, as read out and as printed on the card. */
export function continuityLine(row: ContinuityRow): string {
  const parts = [`${row.series} ${seriesName(row)}`];
  if (row.firstNo && row.lastNo) {
    parts.push(
      rangeText(row.firstNo, row.lastNo),
      `${row.numbers.toLocaleString("en-IN")} numbers`,
      `${row.issued.toLocaleString("en-IN")} issued`,
      `${row.cancelled.toLocaleString("en-IN")} cancelled`,
    );
  } else {
    parts.push(CONTINUITY.noReceipts);
  }
  parts.push(stateText(row));
  return parts.join(", ");
}

const TONE: Record<ContinuityState, ChipTone> = { continuous: "ok", open_gap: "critical", missing: "attention" };

function pad(no: number): string {
  return String(no).padStart(6, "0");
}

export interface ContinuityCardProps {
  rows: ContinuityRow[];
  /** 'today' or a date range, for the title "Number continuity, today". */
  rangeLabel: string;
  canResolve: boolean;
  onResolve(gap: ContinuityGap): void;
}

export function ContinuityCard({ rows, rangeLabel, canResolve, onResolve }: ContinuityCardProps): JSX.Element {
  const states = rows.map(continuityState);
  const gapCount = rows.reduce((sum, r) => sum + r.openGaps, 0);
  const summaryTone: ChipTone = gapCount > 0 ? "critical" : states.includes("missing") ? "attention" : "ok";
  const summaryText =
    gapCount > 0 ? CONTINUITY.someGaps(gapCount) : states.includes("missing") ? CONTINUITY.someMissing : CONTINUITY.allContinuous;
  // The web series has no numbers before Phase 2; it is listed so nobody wonders where W went.
  const hasWeb = rows.some((r) => r.series.startsWith("W"));

  return (
    <section
      aria-labelledby="continuity-heading"
      className="flex flex-col gap-3 rounded-(--radius-surface) border border-(--border) bg-(--card) p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Bilingual
          as="h2"
          en={CONTINUITY.title(rangeLabel)}
          kn={CONTINUITY.titleKn}
          className="text-(length:--text-h3) font-semibold text-(--foreground)"
        />
        <span data-testid="continuity-summary" data-tone={summaryTone} role="status">
          <Chip tone={summaryTone}>{summaryText}</Chip>
        </span>
      </div>

      <ul className="flex flex-col divide-y divide-(--border)">
        {rows.map((row, i) => {
          const state = states[i];
          return (
            <li key={`${row.series}-${row.year}`} data-testid={`continuity-${row.series}`} className="flex flex-col gap-2 py-3 first:pt-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-(length:--text-ui) text-(--foreground)">
                  <span className="sr-only">{continuityLine(row)}</span>
                  <span aria-hidden="true">
                    <strong className="mr-2 font-mono">{row.series}</strong>
                    <strong>{seriesName(row)}</strong>
                    <span className="block text-(length:--text-meta) text-(--muted-foreground) tabular-nums">
                      {continuityLine(row).split(", ").slice(1, -1).join(" · ")}
                    </span>
                  </span>
                </p>
                <Chip tone={TONE[state]}>{stateText(row)}</Chip>
              </div>
              {(row.gaps ?? []).map((gap) => (
                <div
                  key={gap.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-control) bg-(--destructive-soft) px-3 py-2"
                >
                  <span className="text-(length:--text-meta) font-semibold text-(--destructive) tabular-nums">
                    {CONTINUITY.gapLine(pad(gap.fromNo), pad(gap.toNo), gap.cause)}
                  </span>
                  {canResolve ? (
                    <Button
                      variant="seva-secondary"
                      size="sm"
                      aria-label={CONTINUITY.resolveLabel(pad(gap.fromNo), pad(gap.toNo))}
                      onClick={() => onResolve(gap)}
                    >
                      {CONTINUITY.resolve}
                    </Button>
                  ) : null}
                </div>
              ))}
            </li>
          );
        })}
        {hasWeb ? null : (
          <li data-testid="continuity-W" className="flex flex-wrap items-start justify-between gap-2 py-3">
            <p className="min-w-0 flex-1 text-(length:--text-ui) text-(--muted-foreground)">{CONTINUITY.web.line}</p>
            <Chip tone="neutral">{CONTINUITY.web.badge}</Chip>
          </li>
        )}
      </ul>

      {gapCount > 0 && !canResolve ? (
        <Bilingual as="div" en={CONTINUITY.adminResolves.en} kn={CONTINUITY.adminResolves.kn} className="text-(length:--text-meta) text-(--muted-foreground)" />
      ) : null}
      <Bilingual as="div" en={CONTINUITY.format.en} kn={CONTINUITY.format.kn} className="text-(length:--text-meta) text-(--muted-foreground)" />
    </section>
  );
}

export default ContinuityCard;
