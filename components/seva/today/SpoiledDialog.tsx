"use client";

import type { JSX } from "react";

import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SPOILED } from "@/lib/seva/strings/today";

import { shortNo } from "./CancelDialog";

export interface SpoiledDialogProps {
  open: boolean;
  receiptNo: string;
  devoteeName: string;
  busy: boolean;
  /** The office's message when the last try failed. */
  error: string | null;
  onConfirm(): void;
  onClose(): void;
}

/**
 * "Spoiled - cancel and reissue" (DB §9.8, C-21) asks once: the spoiled number is cancelled with reason "Spoiled
 * print" and the same payment gets the next number of this counter, which is printed straight away.
 * Plan A4P-2: the confirm button shows "Reissuing..." with a spinner from the click until the new slip is printed.
 */
export function SpoiledDialog({ open, receiptNo, devoteeName, busy, error, onConfirm, onClose }: SpoiledDialogProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent variant="seva" showCloseButton={false}>
        <div className="flex flex-col gap-1">
          <DialogTitle variant="seva">{SPOILED.title(shortNo(receiptNo))}</DialogTitle>
          <DialogDescription className="text-(length:--text-meta) text-(--muted-foreground)">
            {`${receiptNo} - ${devoteeName}`}
          </DialogDescription>
        </div>
        <Bilingual as="div" en={SPOILED.body.en} kn={SPOILED.body.kn} className="text-(length:--text-ui) text-(--foreground)" />
        {error ? (
          <p role="alert" className="text-(length:--text-meta) font-semibold text-(--destructive)">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="seva-secondary" onClick={onClose} disabled={busy}>
            {SPOILED.keep}
          </Button>
          <PendingButton variant="seva-primary" onClick={onConfirm} pending={busy} pendingLabel={SPOILED.reissuing}>
            {SPOILED.go}
          </PendingButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SpoiledDialog;
