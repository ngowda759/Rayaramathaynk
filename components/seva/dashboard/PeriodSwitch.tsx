"use client";

import type { JSX } from "react";

import { Segmented } from "@/components/seva/ui/Segmented";
import { DASHBOARD, PERIODS } from "@/lib/seva/strings/dashboard";
import type { Period } from "@/lib/seva/time";

export interface PeriodSwitchProps {
  value: Period;
  onChange(p: Period): void;
  /** The chosen period's numbers are still loading: a small spinner shows beside the switch (plan A4P-3). */
  pending?: boolean;
}

/**
 * The period switch (DB §12.1 item 1): Today / This week / This month / This year; every number and chart follows it.
 * Phones get the short labels (Week, Month, Year) so the four choices fit at 390 px; only one of the two is ever
 * displayed, so assistive technology sees one radio group. While the new period loads a small spinner turns beside it;
 * its place is kept when idle, so nothing moves when it appears.
 */
export function PeriodSwitch({ value, onChange, pending = false }: PeriodSwitchProps): JSX.Element {
  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <div className="hidden sm:block">
        <Segmented
          name="period"
          label={DASHBOARD.periodLabel}
          value={value}
          onChange={onChange}
          options={PERIODS.map((p) => ({ value: p.value, en: p.en, kn: p.kn }))}
        />
      </div>
      <div className="min-w-0 flex-1 sm:hidden [&>div]:flex [&>div]:w-full [&_button]:flex-1 [&_button]:px-2">
        <Segmented
          name="period-phone"
          label={DASHBOARD.periodLabel}
          value={value}
          onChange={onChange}
          options={PERIODS.map((p) => ({ value: p.value, en: p.short, kn: p.kn }))}
        />
      </div>
      <span className="flex size-5 flex-none items-center justify-center">
        {pending ? (
          <span
            role="status"
            aria-label={DASHBOARD.refreshing}
            data-testid="period-pending"
            className="block size-4 animate-spin rounded-full border-2 border-(--primary-press) border-t-transparent"
          />
        ) : null}
      </span>
    </div>
  );
}

export default PeriodSwitch;
