"use client";

import type { JSX } from "react";

import type { CounterStep } from "@/lib/seva/counter/state";
import { COUNTER_TEXT } from "@/lib/seva/strings/counter";

export interface StepIndicatorProps {
  step: CounterStep;
  onGo(step: CounterStep): void;
}

const STEPS: { step: CounterStep; label: { en: string; kn: string } }[] = [
  { step: 1, label: COUNTER_TEXT.steps.devotee },
  { step: 2, label: COUNTER_TEXT.steps.sevas },
  { step: 3, label: COUNTER_TEXT.steps.pay },
];

/** "1 Devotee - 2 Sevas and dates - 3 Pay and print" (Design Book 9). Each step is a button; Alt+1/2/3 do the same. */
export function StepIndicator({ step, onGo }: StepIndicatorProps): JSX.Element {
  return (
    <nav aria-label={COUNTER_TEXT.stepsLabel} className="flex flex-wrap items-center gap-2">
      {STEPS.map((s, i) => {
        const current = s.step === step;
        const done = s.step < step;
        return (
          <div key={s.step} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden="true" className="h-px w-6 bg-(--border-strong)" /> : null}
            <button
              type="button"
              aria-current={current ? "step" : undefined}
              aria-keyshortcuts={`Alt+${s.step}`}
              onClick={() => onGo(s.step)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-full border px-3.5 py-1.5 text-left text-(length:--text-ui) font-semibold ${
                current
                  ? "border-(--primary-press) bg-(--primary-soft) text-(--foreground)"
                  : "border-transparent bg-transparent text-(--muted-foreground) hover:text-(--foreground)"
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid size-7 shrink-0 place-items-center rounded-full text-[14px] font-bold ${
                  current || done ? "bg-(--primary) text-(--primary-ink)" : "border border-(--border-strong) bg-(--secondary)"
                }`}
              >
                {s.step}
              </span>
              <span className="flex flex-col leading-tight">
                {s.label.en}
                <span className="kn" lang="kn">
                  {s.label.kn}
                </span>
              </span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}

export default StepIndicator;
