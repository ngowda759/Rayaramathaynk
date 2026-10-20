"use client";

import type { JSX, ReactNode } from "react";
import { m } from "framer-motion";

type DataAttributes = { [key: `data-${string}`]: string | undefined };

export interface PendingLineProps extends DataAttributes {
  /** Shows the line: a later change is being asked for while the earlier answer stays on screen. */
  pending: boolean;
  /** Accessible name of the line while it shows, from the screen's strings. */
  label: string;
  /** A light sweeps along the line while the office is asked. False keeps it still (while a person types). Default true. */
  sweep?: boolean;
}

/**
 * The inline pending line above a list or report (plan A4P-3, shared since A4P-FIX): a 3 px track that always keeps its
 * place, so nothing moves when it shows. Used on later changes only; the first load shows skeleton blocks instead.
 * Extra `data-*` attributes go on the line itself while it shows, so a screen's tests can find it.
 */
export function PendingLine({ pending, label, sweep = true, ...data }: PendingLineProps): JSX.Element {
  return (
    <div aria-hidden={pending ? undefined : true} className="relative h-[3px] overflow-hidden rounded-full">
      {pending ? (
        <div
          role="status"
          aria-label={label}
          data-pending-line="true"
          {...data}
          className="absolute inset-0 overflow-hidden rounded-full bg-(--muted)"
        >
          {sweep ? (
            <m.span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-(--primary)"
              initial={{ x: "-100%" }}
              animate={{ x: "300%" }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export interface PendingContentProps {
  /** A later answer is on its way: the content on screen is the earlier one, dimmed and marked busy. */
  pending: boolean;
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}

/** Keeps the earlier answer on screen while a later one loads: dimmed and aria-busy, never blanked. */
export function PendingContent({ pending, children, className, ...props }: PendingContentProps): JSX.Element {
  return (
    <m.div
      aria-busy={pending || undefined}
      className={className}
      initial={false}
      animate={{ opacity: pending ? 0.55 : 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      {...props}
    >
      {children}
    </m.div>
  );
}

export default PendingLine;
