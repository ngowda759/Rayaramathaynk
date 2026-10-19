"use client";

import type { JSX } from "react";

import { Segmented } from "@/components/seva/ui/Segmented";
import { DASHBOARD, PERIODS } from "@/lib/seva/strings/dashboard";
import type { Period } from "@/lib/seva/time";

export interface PeriodSwitchProps {
  value: Period;
  onChange(p: Period): void;
}

/**
 * The period switch (DB §12.1 item 1): Today / This week / This month / This year; every number and chart follows it.
 * Phones get the short labels (Week, Month, Year) so the four choices fit at 390 px; only one of the two is ever
 * displayed, so assistive technology sees one radio group.
 */
export function PeriodSwitch({ value, onChange }: PeriodSwitchProps): JSX.Element {
  return (
    <>
      <div className="hidden sm:block">
        <Segmented
          name="period"
          label={DASHBOARD.periodLabel}
          value={value}
          onChange={onChange}
          options={PERIODS.map((p) => ({ value: p.value, en: p.en, kn: p.kn }))}
        />
      </div>
      <div className="w-full sm:hidden [&>div]:flex [&>div]:w-full [&_button]:flex-1 [&_button]:px-2">
        <Segmented
          name="period-phone"
          label={DASHBOARD.periodLabel}
          value={value}
          onChange={onChange}
          options={PERIODS.map((p) => ({ value: p.value, en: p.short, kn: p.kn }))}
        />
      </div>
    </>
  );
}

export default PeriodSwitch;
