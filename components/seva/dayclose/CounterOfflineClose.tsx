"use client";

import type { JSX } from "react";

import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { sevaControlClass } from "@/components/ui/input";
import { visibleChars } from "@/lib/seva/schemas";
import { DAYCLOSE_OFFLINE, lastSeenLine } from "@/lib/seva/strings/dayclose";
import { SevaClientError } from "@/services/seva/http";

/** The same rule as the office (dayCloseSchema.counterOfflineReason, seva_close_day): 3 visible characters. */
export const OFFLINE_REASON_MIN = 3;

export function offlineReasonIsEnough(reason: string): boolean {
  return visibleChars(reason.trim()) >= OFFLINE_REASON_MIN;
}

/**
 * The office's answer when it refused the close only because the counter PC has not reported lately
 * (SEVA:outbox_not_empty with reason counter_not_seen): the PC's last report, else null for any other failure.
 */
export function counterNotSeen(err: unknown): { lastSeenAt: string | null } | null {
  if (!(err instanceof SevaClientError) || err.code !== "outbox_not_empty" || err.detail?.reason !== "counter_not_seen") {
    return null;
  }
  const seen = err.detail.last_seen_at;
  return { lastSeenAt: typeof seen === "string" ? seen : null };
}

export interface CounterOfflineCloseProps {
  /** The counter PC's last report as the office answered it (ISO time), when it said. */
  lastSeenAt: string | null;
  /** A temple admin or super admin who is not view-only: the only people the office lets close without the PC. */
  canOverride: boolean;
  reason: string;
  onReasonChange(value: string): void;
  closing: boolean;
  /** Something else on the page still stops the close (a count, the UPI total, the note): the button waits for it. */
  blocked: boolean;
  onCloseAnyway(): Promise<void>;
}

function istTime(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true })
    .format(d)
    .toUpperCase();
}

/**
 * Close day refused because the counter PC has not reported for over 2 minutes (outbox_not_empty, reason
 * counter_not_seen; A5-FIX M-2, F5-3). Everyone sees what that means and what to do. A temple admin also gets "Close
 * anyway" with a required reason, which sends counterOfflineOk with the reason; a receptionist is told to ask one.
 */
export function CounterOfflineClose({
  lastSeenAt,
  canOverride,
  reason,
  onReasonChange,
  closing,
  blocked,
  onCloseAnyway,
}: CounterOfflineCloseProps): JSX.Element {
  const time = lastSeenAt ? istTime(lastSeenAt) : null;
  const seen = time ? lastSeenLine(time) : null;
  return (
    <section
      role="alert"
      aria-labelledby="dc-offline-title"
      data-testid="dc-counter-offline"
      className="flex flex-col gap-3 rounded-(--radius-card) border border-(--border) bg-(--attn-soft) p-5"
    >
      <h2 id="dc-offline-title" className="text-(length:--text-h2) font-semibold">
        {DAYCLOSE_OFFLINE.title.en}
        <span className="kn" lang="kn">
          {DAYCLOSE_OFFLINE.title.kn}
        </span>
      </h2>
      <Bilingual as="div" en={`${DAYCLOSE_OFFLINE.why.en}${seen ? ` ${seen.en}` : ""}`} kn={`${DAYCLOSE_OFFLINE.why.kn}${seen ? ` ${seen.kn}` : ""}`} />
      <Bilingual as="div" en={DAYCLOSE_OFFLINE.whatToDo.en} kn={DAYCLOSE_OFFLINE.whatToDo.kn} />
      {canOverride ? (
        <div className="flex max-w-lg flex-col gap-2">
          <Bilingual as="div" en={DAYCLOSE_OFFLINE.adminChoice.en} kn={DAYCLOSE_OFFLINE.adminChoice.kn} className="text-(length:--text-meta)" />
          <Bilingual
            as="label"
            htmlFor="dc-offline-reason"
            en={DAYCLOSE_OFFLINE.reasonLabel.en}
            kn={DAYCLOSE_OFFLINE.reasonLabel.kn}
            className="text-(length:--text-meta) font-semibold"
          />
          <textarea
            id="dc-offline-reason"
            className={`${sevaControlClass} h-auto min-h-20 bg-(--card) py-2.5`}
            value={reason}
            maxLength={500}
            required
            aria-describedby="dc-offline-hint"
            disabled={closing}
            onChange={(e) => onReasonChange(e.target.value)}
          />
          <span id="dc-offline-hint" className="text-(length:--text-meta) text-(--muted-foreground)">
            {DAYCLOSE_OFFLINE.reasonHint.en}
          </span>
          <div>
            <PendingButton
              variant="seva-primary"
              pending={closing}
              pendingLabel={DAYCLOSE_OFFLINE.closingAnyway.en}
              disabled={blocked || !offlineReasonIsEnough(reason)}
              action={onCloseAnyway}
            >
              {DAYCLOSE_OFFLINE.closeAnyway.en}
            </PendingButton>
          </div>
        </div>
      ) : (
        <Bilingual as="div" en={DAYCLOSE_OFFLINE.askAdmin.en} kn={DAYCLOSE_OFFLINE.askAdmin.kn} className="font-semibold" />
      )}
    </section>
  );
}

export default CounterOfflineClose;
