"use client";

import type { JSX } from "react";
import { AnimatePresence, m } from "framer-motion";

import { SevaLink } from "@/components/seva/motion/SevaLink";
import { StatusPill } from "@/components/seva/ui/StatusPill";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Switch } from "@/components/ui/switch";
import { buttonVariants } from "@/components/ui/button";
import type { ConnectionState } from "@/lib/seva/offline/connection";
import { COUNTER_TEXT, clockSkewText, rupees, waitingText } from "@/lib/seva/strings/counter";
import { SEVA_ROUTES } from "@/lib/seva/routes";

export interface StatusStripProps {
  counterName: string;
  /** 'Ramesh - 023'. */
  staffLabel: string;
  connection: ConnectionState;
  /** Informational only; the office decides the real number. */
  nextNumber: string;
  today: { receipts: number; cashPaise: number; upiPaise: number };
  skewMs: number;
  dayClosed: boolean;
  onForcedOffline(on: boolean): void;
}

/** A count that springs (a quick grow and settle) each time it changes, never on first show. */
function PoppingCount({ value }: { value: number }): JSX.Element {
  return (
    <AnimatePresence initial={false}>
      <m.b key={value} className="num inline-block" initial={{ scale: 1.35, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }}>
        {value}
      </m.b>
    </AnimatePresence>
  );
}

/**
 * The slim counter status strip (Design Book 9.1): counter and person, connection, the next number, today's count and
 * cash/UPI totals, what is waiting to send, the "Work offline" switch and "Close day". Warns when the PC clock is
 * more than 2 minutes off (8.3). Plan A4P-2: the connection pill and the waiting count spring when they change.
 */
export function StatusStrip({
  counterName,
  staffLabel,
  connection,
  nextNumber,
  today,
  skewMs,
  dayClosed,
  onForcedOffline,
}: StatusStripProps): JSX.Element {
  const skew = clockSkewText(skewMs);
  const offline = connection.status === "offline";
  const pill = dayClosed
    ? COUNTER_TEXT.dayClosedTitle.en
    : offline
      ? `${COUNTER_TEXT.offline} - ${waitingText(connection.waiting)}`
      : COUNTER_TEXT.online;

  return (
    <div
      role="region"
      aria-label={COUNTER_TEXT.statusLabel}
      className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-b border-(--border) bg-(--card) px-6 py-2 text-(length:--text-ui) max-sm:px-4"
    >
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <b>{counterName}</b>
        <span className="meta">{staffLabel}</span>
      </span>
      <StatusPill tone={dayClosed ? "closed" : offline ? "offline" : "online"}>{pill}</StatusPill>
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="meta">{COUNTER_TEXT.nextNumber.en}</span>
        <b className="num" data-testid="counter-next-number">
          {nextNumber}
        </b>
      </span>
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <b className="num">{today.receipts}</b> <span className="meta">{COUNTER_TEXT.today.en}</span>
      </span>
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="meta">{COUNTER_TEXT.cash.en}</span>
        <b className="amount">{rupees(today.cashPaise)}</b>
      </span>
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="meta">{COUNTER_TEXT.upi.en}</span>
        <b className="amount">{rupees(today.upiPaise)}</b>
      </span>
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap" data-testid="counter-waiting">
        <PoppingCount value={connection.waiting} /> <span className="meta">{COUNTER_TEXT.waiting.en}</span>
      </span>
      {skew ? (
        <span role="alert" className="rounded-full bg-(--destructive-soft) px-3 py-1 text-(length:--text-meta) font-semibold text-(--destructive)">
          {skew}
        </span>
      ) : null}
      <span className="grow" />
      <label className="inline-flex min-h-9 cursor-pointer items-center gap-2.5">
        <Switch
          variant="seva"
          aria-label={COUNTER_TEXT.workOffline.en}
          checked={connection.forced}
          onCheckedChange={(on) => onForcedOffline(on)}
        />
        <Bilingual en={COUNTER_TEXT.workOffline.en} kn={COUNTER_TEXT.workOffline.kn} className="leading-tight" />
      </label>
      <SevaLink href={SEVA_ROUTES.dayClose} className={buttonVariants({ variant: "seva-secondary", size: "sm" })}>
        {COUNTER_TEXT.closeDay.en}
      </SevaLink>
    </div>
  );
}

export default StatusStrip;
