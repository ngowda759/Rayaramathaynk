import type { JSX } from "react";

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
 */
export function OfflineBanner({ since, waiting, series }: OfflineBannerProps): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-1 rounded-(--radius-surface) border border-[color-mix(in_oklab,var(--primary-press)_45%,transparent)] bg-(--attn-soft) px-5 py-4 text-(length:--text-ui) text-(--foreground)"
    >
      <span>{offlineBannerText({ sinceIso: since, waiting, series })}</span>
      <span className="kn" lang="kn">
        {OFFLINE_BANNER_KN}
      </span>
    </div>
  );
}

export default OfflineBanner;
