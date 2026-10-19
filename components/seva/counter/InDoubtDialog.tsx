"use client";

import { useRef, type JSX } from "react";

import { MotionDialog } from "@/components/seva/motion/MotionDialog";
import { Pressable } from "@/components/seva/motion/Pressable";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button, buttonVariants } from "@/components/ui/button";
import { DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { COUNTER_TEXT } from "@/lib/seva/strings/counter";

export interface InDoubtDialogProps {
  open: boolean;
  onAnswer(printOffline: boolean): void;
}

/**
 * The in-doubt online save (Design Book 8.6, C-53): the office did not answer three tries of the same order. Yes
 * prints it with this PC's offline numbers (the office cancels its own copy if it had stored one); No keeps the order
 * on screen and prints nothing. Plan A4P-2: it springs in and out (MotionDialog); the cursor starts on Yes as before,
 * and Escape or the scrim mean No.
 */
export function InDoubtDialog({ open, onAnswer }: InDoubtDialogProps): JSX.Element {
  const yesRef = useRef<HTMLButtonElement | null>(null);
  return (
    <MotionDialog open={open} onOpenChange={(next) => (next ? undefined : onAnswer(false))} showCloseButton={false} initialFocus={yesRef}>
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
        <Pressable ref={yesRef} className={buttonVariants({ variant: "seva-primary" })} onClick={() => onAnswer(true)}>
          {COUNTER_TEXT.inDoubtYes.en}
        </Pressable>
      </DialogFooter>
    </MotionDialog>
  );
}

export default InDoubtDialog;
