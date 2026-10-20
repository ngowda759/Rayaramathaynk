import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { formatReceiptNo } from "@/lib/seva/numbering";
import type { Bi } from "@/lib/seva/strings/common";
import { RS } from "@/lib/seva/strings/receipt-settings";

import { SettingsCard } from "./ReceiptSettingsFields";

/**
 * Settings - Receipts: the receipt number part by part and the four formats of DB §8.1 (counter online, counter
 * offline, website, temple app), built with the same `formatReceiptNo` the server and the slip use, for the signed-in
 * person's staff number and the current IST month. Numbering is fixed by design (D33), so this card only explains it.
 */

export interface NumberingPreviewProps {
  staffNo: number;
  month: number;
  year: number;
  /** The counter number for the C and OF samples (default 1). */
  counterNo?: number;
}

export interface NumberingSample {
  key: "online" | "offline" | "web" | "app";
  label: Bi;
  hint: Bi;
  number: string;
}

/** The four sample numbers of DB §8.1. */
export function numberingSamples(p: NumberingPreviewProps): NumberingSample[] {
  const n = p.counterNo ?? 1;
  const base = { month: p.month, year: p.year };
  return [
    {
      key: "online",
      label: RS.formatOnline,
      hint: RS.formatOnlineHint,
      number: formatReceiptNo({ ...base, series: `C${n}`, staffNo: p.staffNo, channel: null, running: 124 }),
    },
    {
      key: "offline",
      label: RS.formatOffline,
      hint: RS.formatOfflineHint,
      number: formatReceiptNo({ ...base, series: `OF${n}`, staffNo: p.staffNo, channel: null, running: 7 }),
    },
    {
      key: "web",
      label: RS.formatWeb,
      hint: RS.formatWebHint,
      number: formatReceiptNo({ ...base, series: "W", staffNo: null, channel: "WEB", running: 45 }),
    },
    {
      key: "app",
      label: RS.formatApp,
      hint: RS.formatAppHint,
      number: formatReceiptNo({ ...base, series: "W", staffNo: null, channel: "APP", running: 46 }),
    },
  ];
}

const PART_SEPARATORS = ["-", "-", "/"] as const;

export function NumberingPreview(props: NumberingPreviewProps): JSX.Element {
  const samples = numberingSamples(props);
  const online = samples[0].number;
  // 'C1-023-10-2026/000124' -> C1 | 023 | 10-2026 | 000124
  const match = /^([^-]+)-(\d{3})-(\d{2}-\d{4})\/(\d{6})$/.exec(online);
  const parts: { value: string; label: Bi }[] = match
    ? [
        { value: match[1], label: RS.partSeries },
        { value: match[2], label: RS.partStaffNo },
        { value: match[3], label: RS.partMonthYear },
        { value: match[4], label: RS.partRunning },
      ]
    : [];

  return (
    <SettingsCard
      title={RS.numbersTitle}
      testId="numbering-preview"
      aside={
        <span className="rounded-(--radius-pill) border border-(--border) px-3 py-1 text-(length:--text-meta)">
          <Bilingual en={RS.calendarYear.en} kn={RS.calendarYear.kn} />
        </span>
      }
    >
      <ol aria-label="Parts of a receipt number" className="m-0 flex list-none flex-wrap items-stretch gap-2 p-0">
        {parts.map((part, i) => (
          <li key={part.label.en} className="flex items-center gap-2">
            <span className="flex flex-col items-center gap-1 rounded-(--radius-control) border border-(--border-strong) bg-(--muted) px-3 py-2 text-center">
              <b className="font-mono text-(length:--text-body-lg) tabular-nums">{part.value}</b>
              <Bilingual en={part.label.en} kn={part.label.kn} className="text-(length:--text-micro) text-(--muted-foreground)" />
            </span>
            {i < PART_SEPARATORS.length ? (
              <span aria-hidden="true" className="font-mono text-(length:--text-body-lg) text-(--muted-foreground)">
                {PART_SEPARATORS[i]}
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <ul className="m-0 flex list-none flex-col p-0">
        {samples.map((s) => (
          <li
            key={s.key}
            data-format={s.key}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-(--border) py-3 first:border-t-0"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <Bilingual en={s.label.en} kn={s.label.kn} className="font-semibold" />
              <Bilingual en={s.hint.en} kn={s.hint.kn} className="meta" />
            </div>
            <span className="font-mono text-(length:--text-ui) tabular-nums break-all">{s.number}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1">
        <Bilingual as="div" en={`${RS.yearlyRestart.en}.`} kn={RS.yearlyRestart.kn} className="font-semibold" />
        <Bilingual as="div" en={RS.neverSkip.en} kn={RS.neverSkip.kn} className="meta" />
      </div>
    </SettingsCard>
  );
}

export default NumberingPreview;
