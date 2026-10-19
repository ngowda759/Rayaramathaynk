import Link from "next/link";
import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { attentionText, orderAttention, visibleAttention } from "@/lib/seva/dashboard/attention-text";
import { DASHBOARD } from "@/lib/seva/strings/dashboard";
import type { NeedsAttentionCard } from "@/types/seva-reports";

export interface NeedsAttentionProps {
  cards: NeedsAttentionCard[];
}

const CARD_CLASS: Record<NeedsAttentionCard["level"], string> = {
  critical: "border-[color-mix(in_oklab,var(--destructive)_25%,transparent)] bg-(--destructive-soft)",
  attention: "border-(--border) bg-(--attn-soft)",
  ok: "border-(--border) bg-(--card)",
};

const DOT_CLASS: Record<NeedsAttentionCard["level"], string> = {
  critical: "bg-(--destructive)",
  attention: "bg-(--primary-strong)",
  ok: "bg-(--ok)",
};

const LEVEL_WORD: Record<NeedsAttentionCard["level"], string> = {
  critical: "Urgent",
  attention: "Look at this",
  ok: "All right",
};

/** The words of a card's link, by the screen it opens. */
function goText(href: string): string {
  if (href.startsWith("/admin/receipts/day-closes")) return "Open day closes";
  if (href.startsWith("/admin/receipts/settings")) return "Open counter settings";
  if (href.includes("#continuity")) return "See number continuity";
  return "See receipts";
}

/**
 * Needs attention (DB §12.2): critical cards first, each one line of meaning and a link to the filtered screen
 * behind it; the five core cards always show, a calm "0" line when there is nothing to report.
 */
export function NeedsAttention({ cards }: NeedsAttentionProps): JSX.Element {
  const shown = orderAttention(visibleAttention(cards));
  const toLook = shown.filter((c) => c.level !== "ok").length;
  return (
    <section
      aria-labelledby="attn-h"
      className="flex flex-col gap-3 rounded-[18px] border border-(--border) bg-(--card) p-4 shadow-(--shadow-card) sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="attn-h">
          <Bilingual en={DASHBOARD.needsAttention.en} kn={DASHBOARD.needsAttention.kn} />
        </h2>
        <span className="meta text-(--muted-foreground)" data-testid="attention-count">
          {toLook > 0 ? `${toLook} to look at` : DASHBOARD.nothingToLookAt}
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {shown.map((card) => {
          const t = attentionText(card);
          const body = (
            <>
              <span className="flex items-start gap-2">
                <span aria-hidden="true" className={`mt-1.5 size-2.5 flex-none rounded-full ${DOT_CLASS[card.level]}`} />
                <span className="flex flex-col">
                  <strong className="text-(length:--text-ui) leading-snug">{t.title}</strong>
                  <span className="kn" lang="kn">
                    {t.titleKn}
                  </span>
                </span>
              </span>
              <span className="sr-only">{LEVEL_WORD[card.level]}.</span>
              <span className="meta text-(--muted-foreground)">{t.line}</span>
              {t.href ? (
                <span aria-hidden="true" className="mt-auto pt-1 text-(length:--text-meta) font-semibold text-(--link)">
                  {goText(t.href)} ›
                </span>
              ) : null}
            </>
          );
          const cls = `flex h-full min-w-0 flex-col items-start gap-1.5 rounded-[14px] border p-4 text-(--foreground) no-underline ${CARD_CLASS[card.level]}`;
          return (
            <li key={card.id} data-testid={`attention-${card.id}`} data-level={card.level}>
              {t.href ? (
                <Link href={t.href} className={`${cls} hover:border-(--border-strong)`}>
                  {body}
                </Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default NeedsAttention;
