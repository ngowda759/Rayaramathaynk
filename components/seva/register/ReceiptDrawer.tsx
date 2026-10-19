"use client";

import Link from "next/link";
import { useEffect, useState, type JSX } from "react";

import { MotionDialog } from "@/components/seva/motion/MotionDialog";
import { ReceiptHistory } from "@/components/seva/receipt/ReceiptHistory";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Chip } from "@/components/seva/ui/Chip";
import { Button, buttonVariants } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { prasadamLabel } from "@/lib/seva/strings/receipt";
import { DRAWER, MODE_LABEL, RECEIPT_STATUS } from "@/lib/seva/strings/reports";
import { formatSevaDate } from "@/lib/seva/time";
import type { ReceiptDetail, ReceiptListItem } from "@/types/seva-receipts";

import { issuedWhen, rupees } from "./RegisterTable";
import { receiptPath } from "@/lib/seva/routes";

export interface ReceiptDrawerProps {
  /** The row whose details are shown; the drawer is open while it is set. */
  row: ReceiptListItem | null;
  today: string;
  load(id: string): Promise<ReceiptDetail>;
  onClose(): void;
}

type DetailState = { kind: "loading" } | { kind: "ready"; receipt: ReceiptDetail } | { kind: "error"; message: string };

function Fact({ label, children }: { label: { en: string; kn: string }; children: JSX.Element | string }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-(length:--text-meta) text-(--muted-foreground)">
        <Bilingual en={label.en} kn={label.kn} />
      </dt>
      <dd className="text-(length:--text-ui) font-semibold text-(--foreground)">{children}</dd>
    </div>
  );
}

/**
 * A register row opened (DB §12.3): the receipt's details and its history (prints, cancel, prasadam, audit rows),
 * with a link to the full receipt page. A side sheet on wide screens and a bottom sheet on a phone. It springs in and
 * animates out (MotionDialog, plan A4P-3); while it leaves it still shows the receipt it had.
 */
export function ReceiptDrawer({ row, today, load, onClose }: ReceiptDrawerProps): JSX.Element {
  // The last row opened, kept while the drawer animates out after `row` is cleared.
  const [shown, setShown] = useState<ReceiptListItem | null>(row);
  if (row !== null && row !== shown) setShown(row);

  return (
    <MotionDialog
      open={row !== null}
      onOpenChange={(next) => (next ? undefined : onClose())}
      showCloseButton={false}
      className="max-h-[90vh] overflow-y-auto"
    >
      {shown ? <DrawerBody key={shown.id} row={shown} today={today} load={load} onClose={onClose} /> : null}
    </MotionDialog>
  );
}

function DrawerBody({ row, today, load, onClose }: { row: ReceiptListItem } & Omit<ReceiptDrawerProps, "row">): JSX.Element {
  const [state, setState] = useState<DetailState>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    load(row.id).then(
      (receipt) => {
        if (alive) setState({ kind: "ready", receipt });
      },
      (err: unknown) => {
        if (alive) setState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
      },
    );
    return () => {
      alive = false;
    };
  }, [load, row.id]);

  return (
    <>
      <div className="flex flex-col gap-1">
        <DialogTitle variant="seva">
          <span className="font-mono tabular-nums">{row.receiptNo}</span>
        </DialogTitle>
        <DialogDescription className="text-(length:--text-meta) text-(--muted-foreground)">
          {DRAWER.title.en} · {row.devoteeName} · {rupees(row.totalPaise)}
        </DialogDescription>
      </div>

      {state.kind === "loading" ? (
        <div role="status" className="py-4">
          <Bilingual en={DRAWER.loading.en} kn={DRAWER.loading.kn} className="text-(--muted-foreground)" />
        </div>
      ) : null}
      {state.kind === "error" ? (
        <p role="alert" className="text-(length:--text-meta) font-semibold text-(--destructive)">
          {state.message}
        </p>
      ) : null}
      {state.kind === "ready" ? <DrawerDetails receipt={state.receipt} today={today} /> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="seva-secondary" onClick={onClose}>
          {DRAWER.close}
        </Button>
        <Link href={receiptPath(row.id)} className={buttonVariants({ variant: "seva-primary" })}>
          {DRAWER.open}
        </Link>
      </div>
    </>
  );
}

function DrawerDetails({ receipt, today }: { receipt: ReceiptDetail; today: string }): JSX.Element {
  const prasadam = prasadamLabel(receipt.prasadam);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {receipt.status === "cancelled" ? (
          <Chip tone="critical">{RECEIPT_STATUS.cancelled.en}</Chip>
        ) : (
          <Chip tone="ok">{RECEIPT_STATUS.issued.en}</Chip>
        )}
        {receipt.lines.some((l) => l.changed) ? <Chip tone="attention">{RECEIPT_STATUS.changed.en}</Chip> : null}
        {receipt.printCount > 1 ? <Chip tone="neutral">{RECEIPT_STATUS.duplicate.en}</Chip> : null}
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <Fact label={DRAWER.devotee}>{receipt.devotee.name}</Fact>
        <Fact label={DRAWER.sevaDate}>{formatSevaDate(receipt.sevaDate)}</Fact>
        <Fact label={DRAWER.total}>{rupees(receipt.totalPaise)}</Fact>
        <Fact label={DRAWER.payment}>
          {`${MODE_LABEL[receipt.payment.mode]}${receipt.payment.upiRefLast6 ? ` ...${receipt.payment.upiRefLast6}` : ""}`}
        </Fact>
        <Fact label={DRAWER.issued}>{DRAWER.by(receipt.issuedBy.name, issuedWhen(receipt.issuedAt, today))}</Fact>
        <Fact label={DRAWER.prasadam}>{prasadam.en}</Fact>
      </dl>

      {receipt.count > 1 ? (
        <p className="text-(length:--text-meta) text-(--muted-foreground)">{DRAWER.groupOf(receipt.position, receipt.count)}</p>
      ) : null}

      {receipt.lines.length > 0 ? (
        <ul className="flex flex-col divide-y divide-(--border) rounded-(--radius-control) border border-(--border)">
          {receipt.lines.map((line) => (
            <li key={line.lineNo} className="flex items-start justify-between gap-3 px-3 py-2">
              <Bilingual en={`${line.nameEn}${line.quantity > 1 ? ` x${line.quantity}` : ""}`} kn={line.nameKn} className="text-(length:--text-ui)" />
              <span className="text-(length:--text-ui) font-semibold tabular-nums">{rupees(line.amountPaise)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {receipt.cancel ? (
        <p className="rounded-(--radius-control) bg-(--destructive-soft) px-3 py-2 text-(length:--text-meta) text-(--destructive)">
          {DRAWER.cancelled.en}: {DRAWER.by(receipt.cancel.by, issuedWhen(receipt.cancel.at, today))}
          {receipt.cancel.note ? ` - "${receipt.cancel.note}"` : ""}
        </p>
      ) : null}

      <ReceiptHistory history={receipt.history} />
    </div>
  );
}

export default ReceiptDrawer;
