"use client";

import type { JSX } from "react";

import { PendingButton } from "@/components/seva/motion/PendingButton";
import { TODAY } from "@/lib/seva/strings/today";

export interface ReprintButtonProps {
  /** Records the print with the office and prints the DUPLICATE slip; rejects with the reason it could not. */
  onReprint(): Promise<void>;
  /** Accessible name when several receipts of a group sit side by side: 'Reprint 000124'. */
  label?: string;
  disabled?: boolean;
}

/**
 * Reprint from Today's receipts (DB §9.8, C-22): same number, same QR, with the DUPLICATE band. A second press while
 * the first is still printing is ignored, so one press is one recorded print. Plan A4P-2: "Printing..." with a
 * spinner shows from the press until the slip went to the printer (and for at least 300 ms, so it never flickers).
 */
export function ReprintButton({ onReprint, label, disabled = false }: ReprintButtonProps): JSX.Element {
  return (
    <PendingButton
      variant="seva-secondary"
      size="sm"
      aria-label={label}
      disabled={disabled}
      pendingLabel={TODAY.reprinting}
      // The caller shows the reason a reprint failed; the button only stops spinning.
      action={onReprint}
    >
      {TODAY.reprint}
    </PendingButton>
  );
}

export default ReprintButton;
