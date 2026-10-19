"use client";

import type { JSX } from "react";
import { m } from "framer-motion";

import { OFFLINE_BANNER_KN, offlineBannerText } from "@/lib/seva/strings/counter";

export interface OfflineBannerProps {
  /** ISO time the counter went offline; null when not known. */
  since: string | null;
  /** Outbox items not yet accepted by the office. */
  waiting: number;
  /** The counter's offline series, e.g. 'OF1'. */
  series: string;
}

/**
 * The amber strip shown while the counter works offline (Design Book 9.11, counter mockup `#offline`): receipts still
 * save and print with this PC's OF numbers and send themselves when the line is back. A polite live region.
 * It slides down into place when the line drops and back up when it returns (plan A4P-2; the counter wraps it in
 * AnimatePresence for the way out).
 */
export function OfflineBanner({ since, waiting, series }: OfflineBannerProps): JSX.Element {
  return (
    <m.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16, transition: { duration: 0.16 } }}
      className="flex flex-col gap-1 rounded-(--radius-surface) border border-[color-mix(in_oklab,var(--primary-press)_45%,transparent)] bg-(--attn-soft) px-5 py-4 text-(length:--text-ui) text-(--foreground)"
    >
      <span>{offlineBannerText({ sinceIso: since, waiting, series })}</span>
      <span className="kn" lang="kn">
        {OFFLINE_BANNER_KN}
      </span>
    </m.div>
  );
}

export default OfflineBanner;
