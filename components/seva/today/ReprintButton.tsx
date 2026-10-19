"use client";

import { useRef, useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
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
 * the first is still printing is ignored, so one press is one recorded print.
 */
export function ReprintButton({ onReprint, label, disabled = false }: ReprintButtonProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  async function press(): Promise<void> {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await onReprint();
    } catch {
      // The caller shows the reason; the button only stops spinning.
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="seva-secondary"
      size="sm"
      aria-label={label}
      disabled={disabled}
      loading={busy}
      onClick={() => void press()}
    >
      {TODAY.reprint}
    </Button>
  );
}

export default ReprintButton;
