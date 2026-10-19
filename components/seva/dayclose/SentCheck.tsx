"use client";

import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { DAYCLOSE, waitingLine } from "@/lib/seva/strings/dayclose";

/**
 * Close day, step 4 (DB §9.10, C-24): it must read "Nothing is waiting to send" before the day can close. On the
 * counter PC the page sends a heartbeat first, so the office's count is this PC's own outbox; with items waiting it
 * shows the count and "Send now". Elsewhere it shows the office's last count from that counter.
 */

export interface SentCheckProps {
  /** null while the page is still asking the office. */
  waiting: number | null;
  /** True on the counter PC itself, where "Send now" can send the outbox. */
  canSend: boolean;
  sending: boolean;
  onSendNow(): void;
}

export function SentCheck({ waiting, canSend, sending, onSendNow }: SentCheckProps): JSX.Element {
  const line = waiting === null ? DAYCLOSE.checking : waiting === 0 ? DAYCLOSE.nothingWaiting : waitingLine(waiting);
  const ok = waiting === 0;

  return (
    <section aria-label={DAYCLOSE.sent.en} className="flex flex-col gap-3 rounded-(--radius-card) border border-(--border) bg-(--card) p-5 shadow-(--shadow-card)">
      <Bilingual as="h2" en={DAYCLOSE.sent.en} kn={DAYCLOSE.sent.kn} className="text-(length:--text-h2) font-semibold" />
      <div className="flex items-start gap-3" role="status" aria-live="polite" data-testid="dc-sent">
        <span
          aria-hidden="true"
          className={`mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
            ok ? "bg-(--ok-soft) text-(--ok)" : "bg-(--attn-soft) text-(--accent-foreground)"
          }`}
        >
          {ok ? "✓" : "!"}
        </span>
        <Bilingual as="div" en={line.en} kn={line.kn} className="font-semibold" />
      </div>
      {waiting !== null && waiting > 0 ? (
        canSend ? (
          <div>
            <Button variant="seva-secondary" size="sm" loading={sending} onClick={onSendNow}>
              {DAYCLOSE.sendNow.en}
            </Button>
          </div>
        ) : (
          <p className="text-(length:--text-meta) text-(--muted-foreground)">{DAYCLOSE.sendFromCounter.en}</p>
        )
      ) : null}
    </section>
  );
}

export default SentCheck;
