import type { JSX, ReactNode } from "react";

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

/** Small status label (Cancelled, Changed amount, Matches). The dot repeats the tone so colour is not the only signal. */
export function Chip({ tone, children }: ChipProps): JSX.Element {
  return (
    <span
      data-tone={tone}
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-(length:--text-micro) leading-tight font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      <span>{children}</span>
    </span>
  );
}

export default Chip;
