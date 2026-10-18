import type { JSX, ReactNode } from "react";

export type StatusPillTone = "online" | "offline" | "closed";

export interface StatusPillProps {
  tone: StatusPillTone;
  children: ReactNode;
}

const DOTS: Record<StatusPillTone, string> = {
  online: "bg-(--ok) shadow-[0_0_0_3px_var(--ok-soft)]",
  offline: "bg-(--primary-press) shadow-[0_0_0_3px_var(--attn-soft)]",
  closed: "bg-(--muted-foreground) shadow-[0_0_0_3px_var(--secondary)]",
};

/**
 * Counter connection / day state ("Online", "Offline - 3 waiting", "Day closed").
 * A polite live region, so a change is read out without moving focus.
 */
export function StatusPill({ tone, children }: StatusPillProps): JSX.Element {
  return (
    <span
      role="status"
      data-tone={tone}
      className="inline-flex h-[34px] items-center gap-2 rounded-full border border-(--border) bg-(--card) px-3.5 text-(length:--text-meta) font-semibold whitespace-nowrap text-(--foreground)"
    >
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOTS[tone]}`} />
      {children}
    </span>
  );
}

export default StatusPill;
