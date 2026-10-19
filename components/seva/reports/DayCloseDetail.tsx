"use client";

import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Chip } from "@/components/seva/ui/Chip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DAY_CLOSES } from "@/lib/seva/strings/reports";
import { formatSevaDate, istParts, businessDate } from "@/lib/seva/time";
import type { DayCloseListRow } from "@/services/seva/reports.service";

import { BADGE_TONE, counterLabel, differenceText, rupees } from "./DayCloseList";

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = istParts(d);
  return `${formatSevaDate(businessDate(d))} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export interface DayCloseDetailProps {
  /** The close shown; the dialog is open while it is set. */
  row: DayCloseListRow | null;
  onClose(): void;
}

/** One day close (DB §12.4): counts, cash and UPI against expected, the notes and coins counted by value, and the note. */
export function DayCloseDetail({ row, onClose }: DayCloseDetailProps): JSX.Element {
  return (
    <Dialog open={row !== null} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent variant="seva" showCloseButton={false} className="max-h-[90vh] overflow-y-auto">
        {row ? (
          <>
            <div className="flex flex-col gap-1">
              <DialogTitle variant="seva">{DAY_CLOSES.detail.title(counterLabel(row), formatSevaDate(row.businessDate))}</DialogTitle>
              <DialogDescription className="text-(length:--text-meta) text-(--muted-foreground)">
                {DAY_CLOSES.detail.receipts(row.receipts, row.cancelled, row.changed)}
              </DialogDescription>
            </div>
            <div>
              <Chip tone={BADGE_TONE[row.badge]}>{differenceText(row)}</Chip>
            </div>
            <ul className="flex flex-col gap-1 text-(length:--text-ui) text-(--foreground) tabular-nums">
              <li>{DAY_CLOSES.detail.cash(rupees(row.cashExpectedPaise), rupees(row.cashCountedPaise))}</li>
              <li>
                {DAY_CLOSES.detail.upi(
                  row.upiCount,
                  rupees(row.upiExpectedPaise),
                  row.upiBankTotalPaise === null ? DAY_CLOSES.notConfirmed : rupees(row.upiBankTotalPaise),
                )}
              </li>
              <li className="text-(length:--text-meta) text-(--muted-foreground)">
                {DAY_CLOSES.detail.closed(row.closedBy ?? "-", when(row.closedAt))}
              </li>
              {row.reopenedAt ? (
                <li className="text-(length:--text-meta) text-(--muted-foreground)">
                  {DAY_CLOSES.detail.reopened(row.reopenedBy ?? "-", when(row.reopenedAt), row.reopenReason ?? "")}
                </li>
              ) : null}
            </ul>

            {row.counts.length > 0 ? (
              <section className="flex flex-col gap-2">
                <Bilingual as="h3" en={DAY_CLOSES.detail.counts.en} kn={DAY_CLOSES.detail.counts.kn} className="text-(length:--text-meta) font-semibold" />
                <ul className="flex flex-col divide-y divide-(--border) rounded-(--radius-control) border border-(--border)">
                  {row.counts.map((c) => (
                    <li key={`${c.kind}:${c.valuePaise}`} className="flex justify-between gap-3 px-3 py-2 text-(length:--text-ui) tabular-nums">
                      <span>{DAY_CLOSES.detail.denomination(c.kind, rupees(c.valuePaise), c.count)}</span>
                      <span className="font-semibold">{rupees(c.amountPaise)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="flex flex-col gap-1">
              <Bilingual as="h3" en={DAY_CLOSES.detail.note.en} kn={DAY_CLOSES.detail.note.kn} className="text-(length:--text-meta) font-semibold" />
              <p className="text-(length:--text-ui) text-(--foreground)">
                {row.note ? <>&ldquo;{row.note}&rdquo;</> : <span className="text-(--muted-foreground)">{DAY_CLOSES.detail.noNote}</span>}
              </p>
            </section>

            <div className="flex justify-end">
              <Button type="button" variant="seva-secondary" onClick={onClose}>
                {DAY_CLOSES.detail.close}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default DayCloseDetail;
