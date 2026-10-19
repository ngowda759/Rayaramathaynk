import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { COUNTER_TEXT } from "@/lib/seva/strings/counter";

export interface InDoubtNoticeProps {
  /** "open": the in-doubt order is still on the screen; "cleared": it was cleared without a slip. */
  state: "open" | "cleared";
  onDismiss(): void;
}

/**
 * Needs attention at the counter (Design Book 8.6, review H-3): the office did not answer for an order and nothing was
 * printed, so the office may hold it. While it is on the screen, saving again asks the office first. Once cleared, the
 * receptionist checks Today's receipts for an unprinted copy.
 */
export function InDoubtNotice({ state, onDismiss }: InDoubtNoticeProps): JSX.Element {
  const text = state === "open" ? COUNTER_TEXT.inDoubtOrderOpen : COUNTER_TEXT.inDoubtOrderCleared;
  return (
    <div
      role="alert"
      data-testid="in-doubt-notice"
      className="flex items-start justify-between gap-4 rounded-(--radius-surface) border border-(--border-strong) bg-(--secondary) px-5 py-4"
    >
      <Bilingual as="div" en={text.en} kn={text.kn} className="text-(length:--text-ui)" />
      {state === "cleared" ? (
        <Button type="button" variant="seva-ghost" onClick={onDismiss}>
          {COUNTER_TEXT.inDoubtOrderDismiss}
        </Button>
      ) : null}
    </div>
  );
}

export default InDoubtNotice;
