"use client";

import type { JSX } from "react";

import { AnimatedNumber } from "@/components/seva/motion/AnimatedNumber";
import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Chip } from "@/components/seva/ui/Chip";
import { Button } from "@/components/ui/button";
import type { GroupResult } from "@/lib/seva/grouping";
import type { CatalogueIndex, CounterStep, DevoteeDraft, SaveBlock } from "@/lib/seva/counter/state";
import { formatSevaDate } from "@/lib/seva/time";
import { COUNTER_TEXT, SAVE_BLOCK_TEXT, countingRupees, orderSummaryText, rupees, saveButtonText } from "@/lib/seva/strings/counter";

export interface ReceiptSummaryProps {
  devotee: DevoteeDraft;
  groups: GroupResult;
  catalogue: CatalogueIndex;
  step: CounterStep;
  canSave: { ok: true } | { ok: false; block: SaveBlock };
  submitting: boolean;
  onNext(): void;
  /** Saves and prints; the button is pending from the click until this settles. */
  onSave(): void | Promise<void>;
  /** A plain message from the last save (refused by the office, nothing printed ...). */
  message?: { tone: "error" | "info"; text: string } | null;
  /** True when no new receipt may be saved (day closed). */
  saveDisabled?: boolean;
}

function devoteeDetails(d: DevoteeDraft): string {
  return [d.gotra?.text, d.nakshatra?.text, d.rashi?.text]
    .map((t) => t?.trim())
    .filter((t): t is string => !!t)
    .join(" - ");
}

/**
 * "This receipt" (Design Book 9, counter mockup): the devotee, the order grouped by seva date - one card per receipt,
 * changed lines marked - the total and the step's main action. Sticky beside the current step.
 * Plan A4P-2: the total counts to its new value, and Save and print answers the click at once ("Saving and
 * printing..." with a spinner, pressed only once) while the office has not answered yet.
 */
export function ReceiptSummary({
  devotee,
  groups,
  catalogue,
  step,
  canSave,
  submitting,
  onNext,
  onSave,
  message,
  saveDisabled = false,
}: ReceiptSummaryProps): JSX.Element {
  const name = devotee.name.trim();
  const details = devoteeDetails(devotee);
  const receipts = groups.ok ? groups.receipts : [];
  const totalPaise = groups.ok ? groups.totalPaise : 0;
  const block = canSave.ok ? null : SAVE_BLOCK_TEXT[canSave.block];

  return (
    <aside
      aria-labelledby="counter-summary-h"
      className="sticky top-6 flex flex-col gap-5 rounded-(--radius-surface) border border-(--border) bg-(--card) p-6 shadow-(--shadow-card)"
    >
      <h2 id="counter-summary-h" className="m-0">
        {COUNTER_TEXT.summaryTitle.en}
        <span className="kn" lang="kn">
          {COUNTER_TEXT.summaryTitle.kn}
        </span>
      </h2>

      {name ? (
        <div className="flex flex-col gap-0.5">
          <b className="text-[18px] font-semibold">{name}</b>
          {details ? <span className="meta">{details}</span> : null}
        </div>
      ) : null}

      {receipts.length === 0 ? (
        <Bilingual
          as="div"
          en={step === 1 ? COUNTER_TEXT.summaryEmptyStep1.en : COUNTER_TEXT.noLinesYet.en}
          kn={step === 1 ? COUNTER_TEXT.summaryEmptyStep1.kn : COUNTER_TEXT.noLinesYet.kn}
          className="rounded-[14px] border border-dashed border-(--border-strong) p-5 text-center text-(length:--text-ui) text-(--muted-foreground)"
        />
      ) : (
        <>
          <p className="m-0 text-(length:--text-ui) font-semibold">{orderSummaryText(groups)}</p>
          <ol className="m-0 flex max-h-[46vh] list-none flex-col gap-3 overflow-auto p-0">
            {receipts.map((g, i) => (
              <li key={g.sevaDate} className="flex flex-col gap-3 rounded-[14px] bg-(--secondary) p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <b>{formatSevaDate(g.sevaDate)}</b>
                  <span className="meta">
                    {i + 1} / {receipts.length}
                  </span>
                </div>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {g.lines.map((l) => {
                    const seva = catalogue.byId.get(l.sevaId);
                    const changed = l.catalogueRatePaise !== null && l.unitRatePaise !== l.catalogueRatePaise;
                    return (
                      <li key={l.key} className="flex items-start justify-between gap-3 text-(length:--text-ui)">
                        <span className="flex min-w-0 flex-col">
                          <span>
                            {seva?.nameEn ?? l.sevaId}
                            {l.quantity > 1 ? ` x ${l.quantity}` : ""}
                          </span>
                          {seva?.nameKn ? (
                            <span className="kn" lang="kn">
                              {seva.nameKn}
                            </span>
                          ) : null}
                          {changed ? (
                            <span className="mt-1">
                              <Chip tone="attention">{COUNTER_TEXT.changed.en}</Chip>
                            </span>
                          ) : null}
                        </span>
                        <span className="amount font-semibold">{rupees(l.amountPaise)}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </>
      )}

      {!groups.ok && groups.code !== "no_lines" ? (
        <p role="alert" className="m-0 text-(length:--text-meta) font-semibold text-(--destructive)">
          {SAVE_BLOCK_TEXT.group_error.en}
        </p>
      ) : null}

      <div className="flex items-end justify-between gap-3 border-t border-(--border) pt-4">
        <Bilingual en={COUNTER_TEXT.total.en} kn={COUNTER_TEXT.total.kn} className="text-(length:--text-meta) font-semibold" />
        <span className="amount text-(length:--text-display) leading-[1.1] font-bold tracking-[-0.02em]" data-testid="counter-total">
          <AnimatedNumber value={totalPaise} format={countingRupees(totalPaise)} />
        </span>
      </div>

      {step === 3 ? (
        <PendingButton
          variant="seva-primary"
          className="h-14 w-full text-(length:--text-body)"
          disabled={!canSave.ok || saveDisabled}
          pending={submitting}
          pendingLabel={COUNTER_TEXT.saving.en}
          action={async () => {
            await onSave();
          }}
          aria-keyshortcuts="Control+Enter"
          aria-describedby={block ? "counter-save-why" : undefined}
        >
          {saveButtonText(receipts.length)}
          <span className="kbd text-(length:--text-meta) opacity-70">Ctrl+Enter</span>
        </PendingButton>
      ) : (
        <Button
          type="button"
          variant="seva-primary"
          className="h-14 w-full text-(length:--text-body)"
          disabled={step === 1 ? name === "" : false}
          onClick={onNext}
        >
          {step === 1 ? COUNTER_TEXT.nextSevas.en : COUNTER_TEXT.nextPay.en}
          <span className="kbd text-(length:--text-meta) opacity-70">Enter</span>
        </Button>
      )}

      {step === 3 && block && !submitting ? (
        <Bilingual as="div" en={block.en} kn={block.kn} className="meta" />
      ) : null}
      {step === 3 && block && !submitting ? (
        <span id="counter-save-why" className="sr-only">
          {block.en}
        </span>
      ) : null}

      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={
            message.tone === "error"
              ? "m-0 rounded-(--radius-control) bg-(--destructive-soft) px-4 py-3 text-(length:--text-ui) font-semibold text-(--destructive)"
              : "m-0 rounded-(--radius-control) bg-(--secondary) px-4 py-3 text-(length:--text-ui)"
          }
        >
          {message.text}
        </p>
      ) : null}
    </aside>
  );
}

export default ReceiptSummary;
