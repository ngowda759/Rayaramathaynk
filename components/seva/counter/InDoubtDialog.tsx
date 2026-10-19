"use client";

import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { COUNTER_TEXT } from "@/lib/seva/strings/counter";

export interface InDoubtDialogProps {
  open: boolean;
  onAnswer(printOffline: boolean): void;
}

/**
 * The in-doubt online save (Design Book 8.6, C-53): the office did not answer three tries of the same order. Yes
 * prints it with this PC's offline numbers (the office cancels its own copy if it had stored one); No keeps the order
 * on screen and prints nothing.
 */
export function InDoubtDialog({ open, onAnswer }: InDoubtDialogProps): JSX.Element | null {
  if (!open) return null;
  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onAnswer(false))}>
      <DialogContent variant="seva" showCloseButton={false} role="alertdialog" data-counter-dialog="">
        <DialogTitle variant="seva">
          {COUNTER_TEXT.inDoubtTitle.en}
          <span className="kn" lang="kn">
            {COUNTER_TEXT.inDoubtTitle.kn}
          </span>
        </DialogTitle>
        <Bilingual as="div" en={COUNTER_TEXT.inDoubtBody.en} kn={COUNTER_TEXT.inDoubtBody.kn} />
        <DialogFooter>
          <Button type="button" variant="seva-secondary" onClick={() => onAnswer(false)}>
            {COUNTER_TEXT.inDoubtNo.en}
          </Button>
          <Button type="button" variant="seva-primary" autoFocus onClick={() => onAnswer(true)}>
            {COUNTER_TEXT.inDoubtYes.en}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InDoubtDialog;
