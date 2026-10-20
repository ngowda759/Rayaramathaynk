"use client";

import { useId, useState, type JSX } from "react";
import toast from "react-hot-toast";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { sevaControlClass } from "@/components/ui/input";
import { formatRupees } from "@/lib/seva/money";
import { REFUND_MODES, visibleChars, type RefundMode, type RefundSettleRequest } from "@/lib/seva/schemas";
import { REFUND_NOTE_MIN, REFUND_REFERENCE_MIN, REFUND_SETTLE } from "@/lib/seva/strings/reports";
import { cn } from "@/lib/utils";
import type { RefundState } from "@/types/seva-receipts";

export interface MarkRefundedButtonProps {
  /** The receipt; the button shows only when the office knows it (`id`) and its refund is due. */
  receipt: { id: string | null; receiptNo: string; totalPaise: number; refundState: RefundState | null };
  /** The person may settle refunds (`receipt.cancel_any`: temple admins and super admins, not view-only). */
  allowed: boolean;
  settle(body: RefundSettleRequest): Promise<unknown>;
  /** Called after the office recorded the refund, so the caller can reload what it shows. */
  onDone(): void;
}

/**
 * "Mark refunded" (DB §9.9, A5-FIX M-3): a refund-due receipt was paid back by the office outside the module; an admin
 * records how (UPI, bank transfer or cash), the reference and a note. The server checks `receipt.cancel_any` again and
 * writes the receipt.refund_done audit row, which clears the "UPI refunds due" card. Used by the register drawer and
 * by today's receipts.
 */
export function MarkRefundedButton({ receipt, allowed, settle, onDone }: MarkRefundedButtonProps): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const id = receipt.id;
  if (!allowed || id === null || receipt.refundState !== "due") return null;

  return (
    <>
      <Button
        type="button"
        variant="seva-secondary"
        size="sm"
        aria-label={REFUND_SETTLE.openLabel(receipt.receiptNo)}
        onClick={() => setOpen(true)}
      >
        {REFUND_SETTLE.open}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? undefined : setOpen(false))}>
        <DialogContent variant="seva" showCloseButton={false}>
          {open ? (
            <RefundForm
              id={id}
              receiptNo={receipt.receiptNo}
              totalPaise={receipt.totalPaise}
              settle={settle}
              onClose={() => setOpen(false)}
              onDone={() => {
                setOpen(false);
                toast.success(REFUND_SETTLE.done);
                onDone();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RefundForm({
  id,
  receiptNo,
  totalPaise,
  settle,
  onClose,
  onDone,
}: {
  id: string;
  receiptNo: string;
  totalPaise: number;
  settle: MarkRefundedButtonProps["settle"];
  onClose(): void;
  onDone(): void;
}): JSX.Element {
  const ids = useId();
  const [mode, setMode] = useState<RefundMode | "">("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const referenceOk = mode === "cash" || visibleChars(reference.trim()) >= REFUND_REFERENCE_MIN;
  const ready = mode !== "" && referenceOk && visibleChars(note.trim()) >= REFUND_NOTE_MIN && !busy;

  async function confirm(): Promise<void> {
    if (mode === "" || !ready) return;
    const ref = reference.trim();
    setBusy(true);
    setError(null);
    try {
      await settle({ receiptIds: [id], mode, ...(ref === "" ? {} : { reference: ref }), note: note.trim() });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const referenceLabel = mode === "cash" ? REFUND_SETTLE.referenceOptional : REFUND_SETTLE.reference;

  return (
    <>
      <div className="flex flex-col gap-1">
        <DialogTitle variant="seva">
          <span className="tabular-nums">{REFUND_SETTLE.title(receiptNo)}</span>
        </DialogTitle>
        <DialogDescription className="text-(length:--text-meta) text-(--muted-foreground)">
          <Bilingual en={REFUND_SETTLE.description.en} kn={REFUND_SETTLE.description.kn} />
        </DialogDescription>
        <p className="text-(length:--text-ui) font-semibold tabular-nums text-(--foreground)">
          {REFUND_SETTLE.amount(formatRupees(totalPaise, { decimals: totalPaise % 100 !== 0 }))}
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-(length:--text-meta) font-semibold text-(--foreground)">
          <Bilingual en={REFUND_SETTLE.mode.en} kn={REFUND_SETTLE.mode.kn} />
        </legend>
        {REFUND_MODES.map((value) => (
          <label
            key={value}
            htmlFor={`${ids}-${value}`}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-(--radius-control) border border-(--border) px-3 py-2 text-(length:--text-ui) has-checked:border-(--primary-press) has-checked:bg-(--primary-soft)"
          >
            <input
              id={`${ids}-${value}`}
              type="radio"
              name={`${ids}-mode`}
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
              className="size-4 accent-(--primary-press)"
            />
            <Bilingual en={REFUND_SETTLE.modes[value].en} kn={REFUND_SETTLE.modes[value].kn} />
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Bilingual
          as="label"
          htmlFor={`${ids}-reference`}
          en={referenceLabel.en}
          kn={referenceLabel.kn}
          className="text-(length:--text-meta) font-semibold text-(--foreground)"
        />
        <input
          id={`${ids}-reference`}
          value={reference}
          maxLength={60}
          autoComplete="off"
          onChange={(e) => setReference(e.target.value)}
          className={sevaControlClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Bilingual
          as="label"
          htmlFor={`${ids}-note`}
          en={REFUND_SETTLE.note.en}
          kn={REFUND_SETTLE.note.kn}
          className="text-(length:--text-meta) font-semibold text-(--foreground)"
        />
        <textarea
          id={`${ids}-note`}
          value={note}
          maxLength={500}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
          className={cn(sevaControlClass, "h-auto min-h-24 py-3")}
        />
      </div>

      {error ? (
        <p role="alert" className="text-(length:--text-meta) font-semibold text-(--destructive)">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="seva-secondary" onClick={onClose} disabled={busy}>
          {REFUND_SETTLE.cancel}
        </Button>
        <Button type="button" variant="seva-primary" onClick={() => void confirm()} disabled={!ready} loading={busy}>
          {REFUND_SETTLE.save}
        </Button>
      </div>
    </>
  );
}

export default MarkRefundedButton;
