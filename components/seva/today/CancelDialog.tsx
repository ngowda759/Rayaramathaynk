"use client";

import { useId, useMemo, useState, type JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { sevaControlClass } from "@/components/ui/input";
import { formatRupees } from "@/lib/seva/money";
import type { Bi } from "@/lib/seva/strings/common";
import {
  CANCEL_DIALOG,
  CANCEL_REASONS,
  MONEY,
  OTHER_NOTE_MIN,
  type ChosenCancelReason,
} from "@/lib/seva/strings/today";
import { formatSevaDate, istParts } from "@/lib/seva/time";
import { cn } from "@/lib/utils";
import type { PaymentMode } from "@/types/seva";

/** What the dialog needs to know about one receipt it may cancel. */
export interface CancelCandidate {
  key: string;
  receiptNo: string;
  /** 'YYYY-MM-DD'; null when this PC does not know it (the list carries no seva date). */
  sevaDate: string | null;
  totalPaise: number;
  mode: PaymentMode;
  /** IST business date of issue. */
  businessDate: string;
  devoteeName: string;
  issuedAt: string;
  groupNo: string;
}

export interface CancelChoice {
  receipts: CancelCandidate[];
  reasonCode: ChosenCancelReason;
  note?: string;
}

/** 'Rs 820' for whole rupees, 'Rs 610.50' otherwise. */
export function rupees(paise: number): string {
  return formatRupees(paise, { decimals: paise % 100 !== 0 });
}

/** The running part of a receipt number: 'C1-023-10-2026/000124' -> '000124'. */
export function shortNo(receiptNo: string): string {
  const slash = receiptNo.lastIndexOf("/");
  return slash === -1 ? receiptNo : receiptNo.slice(slash + 1);
}

/** A seva date without its year: '2027-08-28' -> 'Sat 28 Aug'. */
export function shortDate(date: string): string {
  return formatSevaDate(date).replace(/ \d{4}$/, "");
}

/** IST clock time as the counter shows it: '11:12 AM'. */
export function istClock(at: Date | string): string {
  const p = istParts(typeof at === "string" ? new Date(at) : at);
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${hour12}:${String(p.minute).padStart(2, "0")} ${p.hour < 12 ? "AM" : "PM"}`;
}

/**
 * What happens to the money when these receipts are cancelled (DB §9.9, C-20): cash of today's business day is handed
 * back from the drawer; UPI, online payments and any earlier day's receipt are refunded by the office. Offline, the
 * drawer still hands the cash back, and the office checks the cancel when it arrives (a late one stays refund due).
 */
export function moneyBackLine(receipts: CancelCandidate[], opts: { today: string; offline: boolean }): Bi {
  const total = receipts.reduce((sum, r) => sum + r.totalPaise, 0);
  const mode = receipts[0]?.mode ?? "cash";
  if (mode === "cash" && receipts.every((r) => r.businessDate === opts.today)) {
    return opts.offline ? MONEY.giveBackOffline(rupees(total)) : MONEY.giveBack(rupees(total), receipts.length);
  }
  return mode === "cash" ? MONEY.refundDueCash : MONEY.refundDueUpi;
}

function modeWords(mode: PaymentMode): string {
  if (mode === "cash") return CANCEL_DIALOG.inCash;
  if (mode === "upi") return CANCEL_DIALOG.byUpi;
  return CANCEL_DIALOG.online;
}

export interface CancelDialogProps {
  open: boolean;
  /** The receipts that may be cancelled here: one, or the issued receipts of one group in position order. */
  receipts: CancelCandidate[];
  /** Today's IST business date. */
  today: string;
  offline: boolean;
  busy: boolean;
  /** The office's message when the last try failed. */
  error: string | null;
  onConfirm(choice: CancelChoice): void;
  onClose(): void;
}

const ALL = "all";

/**
 * Cancel one receipt or a group (DB §9.9): for a group, "All 3 receipts" or "Only 000124, Sat 28 Aug" (C-01); one of
 * the eight reasons (C-60), "Other" with a note; and the money-back line for what is chosen.
 */
export function CancelDialog({ open, receipts, today, offline, busy, error, onConfirm, onClose }: CancelDialogProps): JSX.Element {
  const ids = useId();
  const [scope, setScope] = useState<string>(ALL);
  const [reason, setReason] = useState<ChosenCancelReason | "">("");
  const [note, setNote] = useState("");

  const chosen = useMemo(
    () => (scope === ALL ? receipts : receipts.filter((r) => r.key === scope)),
    [receipts, scope],
  );
  const first = receipts[0];
  const isGroup = receipts.length > 1;
  const noteOk = reason !== "other" || note.trim().length >= OTHER_NOTE_MIN;
  const ready = reason !== "" && noteOk && chosen.length > 0 && !busy;
  const groupTotal = receipts.reduce((sum, r) => sum + r.totalPaise, 0);
  const money = chosen.length > 0 ? moneyBackLine(chosen, { today, offline }) : null;

  function confirm(): void {
    if (!ready) return;
    const trimmed = note.trim();
    onConfirm({ receipts: chosen, reasonCode: reason, ...(trimmed !== "" ? { note: trimmed } : {}) });
  }

  if (!first) return <></>;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent variant="seva" showCloseButton={false}>
        <div className="flex flex-col gap-1">
          <DialogTitle variant="seva">
            {isGroup ? CANCEL_DIALOG.titleGroup(first.groupNo) : CANCEL_DIALOG.titleOne(shortNo(first.receiptNo))}
          </DialogTitle>
          <DialogDescription className="text-(length:--text-meta) text-(--muted-foreground)">
            {CANCEL_DIALOG.subtitle(first.devoteeName, rupees(groupTotal), modeWords(first.mode), istClock(first.issuedAt))}
          </DialogDescription>
        </div>

        {isGroup ? (
          <fieldset className="flex flex-col gap-2" aria-labelledby={`${ids}-scope`}>
            <legend id={`${ids}-scope`} className="mb-1 text-(length:--text-meta) font-semibold text-(--foreground)">
              <Bilingual en={CANCEL_DIALOG.scope.en} kn={CANCEL_DIALOG.scope.kn} />
            </legend>
            {[{ key: ALL, label: CANCEL_DIALOG.all(receipts.length, rupees(groupTotal)) }]
              .concat(
                receipts.map((r) => ({
                  key: r.key,
                  label: CANCEL_DIALOG.only(shortNo(r.receiptNo), r.sevaDate ? shortDate(r.sevaDate) : null, rupees(r.totalPaise)),
                })),
              )
              .map((option) => (
                <label
                  key={option.key}
                  htmlFor={`${ids}-scope-${option.key}`}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-(--radius-control) border border-(--border) px-3 py-2 text-(length:--text-ui) has-checked:border-(--primary-press) has-checked:bg-(--primary-soft)"
                >
                  <input
                    id={`${ids}-scope-${option.key}`}
                    type="radio"
                    name={`${ids}-scope`}
                    value={option.key}
                    checked={scope === option.key}
                    onChange={() => setScope(option.key)}
                    className="size-4 accent-(--primary-press)"
                  />
                  <span className="tabular-nums">{option.label}</span>
                </label>
              ))}
          </fieldset>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Bilingual
            as="label"
            htmlFor={`${ids}-reason`}
            en={CANCEL_DIALOG.reason.en}
            kn={CANCEL_DIALOG.reason.kn}
            className="text-(length:--text-meta) font-semibold text-(--foreground)"
          />
          <select
            id={`${ids}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value as ChosenCancelReason | "")}
            className={sevaControlClass}
          >
            <option value="">{CANCEL_DIALOG.chooseReason}</option>
            {CANCEL_REASONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label.en}
              </option>
            ))}
          </select>
        </div>

        {reason === "other" ? (
          <div className="flex flex-col gap-1.5">
            <Bilingual
              as="label"
              htmlFor={`${ids}-note`}
              en={CANCEL_DIALOG.note.en}
              kn={CANCEL_DIALOG.note.kn}
              className="text-(length:--text-meta) font-semibold text-(--foreground)"
            />
            <textarea
              id={`${ids}-note`}
              value={note}
              maxLength={500}
              rows={3}
              aria-describedby={`${ids}-note-hint`}
              onChange={(e) => setNote(e.target.value)}
              className={cn(sevaControlClass, "h-auto min-h-24 py-3")}
            />
            <span id={`${ids}-note-hint`} className="text-(length:--text-meta) text-(--muted-foreground)">
              {CANCEL_DIALOG.noteHint}
            </span>
          </div>
        ) : null}

        {money ? (
          <p
            aria-live="polite"
            className="rounded-(--radius-control) border border-(--border) bg-(--attn-soft) px-4 py-3 text-(length:--text-ui) font-semibold text-(--foreground)"
          >
            <Bilingual en={money.en} kn={money.kn} />
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-(length:--text-meta) font-semibold text-(--destructive)">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="seva-secondary" onClick={onClose} disabled={busy}>
            {CANCEL_DIALOG.keep}
          </Button>
          <Button type="button" variant="seva-danger" onClick={confirm} disabled={!ready} loading={busy}>
            {isGroup ? CANCEL_DIALOG.goMany : CANCEL_DIALOG.goOne}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CancelDialog;
