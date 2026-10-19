"use client";

import type { JSX, ReactNode } from "react";
import { AnimatePresence, m } from "framer-motion";

import { PRESS } from "@/lib/seva/motion";

export type ChipTone = "neutral" | "attention" | "critical" | "ok";

export interface ChipProps {
  tone: ChipTone;
  children: ReactNode;
}

const TONES: Record<ChipTone, string> = {
  neutral: "bg-(--secondary) text-(--secondary-foreground)",
  attention: "bg-(--attn-soft) text-(--accent-foreground)",
  critical: "bg-(--destructive-soft) text-(--destructive)",
  ok: "bg-(--ok-soft) text-(--ok)",
};

/**
 * Small status label (Cancelled, Changed amount, Matches). The dot repeats the tone so colour is not the only signal.
 * It gives a little under a press, and its dot pops with the module spring when the tone changes (not on first show).
 */
export function Chip({ tone, children }: ChipProps): JSX.Element {
  return (
    <m.span
      data-tone={tone}
      whileTap={PRESS}
      className={`relative inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-(length:--text-micro) leading-tight font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <m.span
          key={tone}
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current"
          initial={{ scale: 0.2 }}
          animate={{ scale: 1 }}
        />
      </AnimatePresence>
      <span>{children}</span>
    </m.span>
  );
}

export default Chip;
