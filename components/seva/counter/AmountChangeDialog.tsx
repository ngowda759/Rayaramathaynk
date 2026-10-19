"use client";

import { useState, type FormEvent, type JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { sevaControlClass } from "@/components/ui/input";
import { MIN_CHANGE_REASON_CHARS } from "@/lib/seva/counter/state";
import { fromPaise, toPaise } from "@/lib/seva/money";
import { COUNTER_TEXT, rupees } from "@/lib/seva/strings/counter";

export interface AmountChangeDialogProps {
  sevaName: string;
  /** The catalogue price for one. */
  catalogueRatePaise: number;
  /** The price for one on the line now (the catalogue price unless already changed). */
  currentRatePaise: number;
  currentReason: string;
  onApply(unitRatePaise: number, reason: string): void;
  onClose(): void;
}

/** A whole or two-decimal rupee amount above zero, else null. */
function parseRate(text: string): number | null {
  try {
    const paise = toPaise(text.trim());
    return paise > 0 ? paise : null;
  } catch {
    return null;
  }
}

/**
 * "Change amount" on a line (Design Book 9.4): a new price for one (quantity x new price) and the reason, which is
 * always needed. The line is then marked "Changed" on screen, in the summary and on the slip; the office checks the
 * change again and writes it to the audit trail. Rendered only while open.
 */
export function AmountChangeDialog({
  sevaName,
  catalogueRatePaise,
  currentRatePaise,
  currentReason,
  onApply,
  onClose,
}: AmountChangeDialogProps): JSX.Element {
  const [rate, setRate] = useState(fromPaise(currentRatePaise).replace(/\.00$/, ""));
  const [reason, setReason] = useState(currentReason);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const paise = parseRate(rate);
    if (paise === null) {
      setError(COUNTER_TEXT.amountInvalid);
      return;
    }
    const back = paise === catalogueRatePaise;
    if (!back && Array.from(reason.trim()).length < MIN_CHANGE_REASON_CHARS) {
      setError(COUNTER_TEXT.reasonTooShort);
      return;
    }
    onApply(paise, back ? "" : reason.trim());
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent variant="seva" data-counter-dialog="">
        <DialogTitle variant="seva">
          {`${COUNTER_TEXT.amountDialogTitle.en} - ${sevaName}`}
          <span className="kn" lang="kn">
            {COUNTER_TEXT.amountDialogTitle.kn}
          </span>
        </DialogTitle>
        <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
          <span className="meta">{COUNTER_TEXT.catalogueRate(rupees(catalogueRatePaise))}</span>
          <div className="flex flex-col gap-1.5">
            <Bilingual
              as="label"
              htmlFor="counter-new-rate"
              en={COUNTER_TEXT.newRate.en}
              kn={COUNTER_TEXT.newRate.kn}
              className="text-(length:--text-meta) font-semibold"
            />
            <input
              id="counter-new-rate"
              className={`${sevaControlClass} amount`}
              inputMode="decimal"
              autoComplete="off"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              aria-invalid={error === COUNTER_TEXT.amountInvalid || undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Bilingual
              as="label"
              htmlFor="counter-change-reason"
              en={COUNTER_TEXT.reason.en}
              kn={COUNTER_TEXT.reason.kn}
              className="text-(length:--text-meta) font-semibold"
            />
            <span id="counter-change-reason-hint" className="meta">
              {COUNTER_TEXT.reasonHint.en}
            </span>
            <textarea
              id="counter-change-reason"
              aria-describedby="counter-change-reason-hint"
              className={`${sevaControlClass} h-auto min-h-[88px] py-3`}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={error === COUNTER_TEXT.reasonTooShort || undefined}
            />
          </div>
          {error ? (
            <p role="alert" className="m-0 text-(length:--text-meta) font-semibold text-(--destructive)">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="seva-ghost" onClick={onClose}>
              {COUNTER_TEXT.cancel.en}
            </Button>
            <Button type="submit" variant="seva-primary">
              {COUNTER_TEXT.apply.en}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AmountChangeDialog;
