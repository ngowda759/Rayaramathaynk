"use client";

import type { JSX } from "react";
import { m } from "framer-motion";

import { Reveal } from "@/components/seva/motion/Reveal";
import { SevaLink } from "@/components/seva/motion/SevaLink";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { buttonVariants } from "@/components/ui/button";
import { SPRING } from "@/lib/seva/motion";
import { formatSevaDate } from "@/lib/seva/time";
import { COUNTER_TEXT, printedTitle, rupees } from "@/lib/seva/strings/counter";
import type { IssuedReceipt } from "@/types/seva";

export interface PrintedPanelProps {
  receipts: IssuedReceipt[];
  /** True when the receipts were made offline with this PC's OF numbers. */
  offline: boolean;
}

/**
 * After save and print (counter mockup `#printed`): how many slips printed, for whom and how it was paid, and one
 * small card per receipt with its seva date and number. The form underneath is already clear for the next devotee.
 * Plan A4P-2: the panel rises in with the module spring and its tick pops a moment later.
 */
export function PrintedPanel({ receipts, offline }: PrintedPanelProps): JSX.Element | null {
  if (receipts.length === 0) return null;
  const first = receipts[0];
  return (
    <Reveal
      as="section"
      role="status"
      aria-label={printedTitle(receipts.length)}
      className="flex flex-col gap-4 rounded-(--radius-surface) border border-(--border) bg-(--card) p-6 shadow-(--shadow-card)"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <m.span
            aria-hidden="true"
            data-printed-tick=""
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SPRING, delay: 0.12 }}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-(--ok-soft) text-[20px] font-bold text-(--ok)"
          >
            ✓
          </m.span>
          <div className="flex flex-col">
            <h2 className="m-0">{printedTitle(receipts.length)}</h2>
            <span className="meta">
              {COUNTER_TEXT.printedSub(first.devotee.name, rupees(first.orderTotalPaise), first.payment.mode, receipts.length > 1, first.groupNo)}
            </span>
          </div>
        </div>
        <SevaLink href="/admin/receipts/counter/today" className={buttonVariants({ variant: "seva-ghost", size: "sm" })}>
          {COUNTER_TEXT.todaysReceipts.en}
        </SevaLink>
      </div>
      {offline ? <Bilingual as="div" en={COUNTER_TEXT.printedOffline.en} kn={COUNTER_TEXT.printedOffline.kn} className="meta" /> : null}
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 p-0">
        {receipts.map((r) => (
          <li key={r.clientReceiptId} className="flex flex-col gap-1 rounded-[14px] border border-(--border) bg-(--background) px-5 py-4">
            <span className="meta">{COUNTER_TEXT.of(r.position, r.count)}</span>
            <b className="text-(length:--text-h2) leading-tight">{formatSevaDate(r.sevaDate)}</b>
            <span className="num" data-testid="printed-receipt-no">
              {r.receiptNo}
            </span>
            <span className="flex items-center justify-between gap-2">
              <span className="meta">{COUNTER_TEXT.sevaCount(r.lines.length)}</span>
              <b className="amount">{rupees(r.totalPaise)}</b>
            </span>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}

export default PrintedPanel;
