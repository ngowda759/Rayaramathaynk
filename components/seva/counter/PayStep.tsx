"use client";

import type { JSX } from "react";

import { AnimatedNumber } from "@/components/seva/motion/AnimatedNumber";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Segmented } from "@/components/seva/ui/Segmented";
import { Button } from "@/components/ui/button";
import { sevaControlClass } from "@/components/ui/input";
import type { PaymentDraft } from "@/lib/seva/counter/state";
import { toPaise } from "@/lib/seva/money";
import { COUNTER_TEXT, countingRupees, toPayText } from "@/lib/seva/strings/counter";
import type { CounterBootstrap } from "@/types/seva";
import { UpiPanel } from "./UpiPanel";

export interface PayStepProps {
  totalPaise: number;
  receiptCount: number;
  payment: PaymentDraft;
  onPayment(patch: Partial<PaymentDraft>): void;
  upi: CounterBootstrap["upi"];
  upiDisabledReason: CounterBootstrap["upiDisabledReason"];
  /** Transaction note inside the UPI QR. */
  upiNote: string;
  /** Cash of Rs 2,00,000 or more needs a confirm (C-54). */
  largeCash: { required: boolean; confirmed: boolean; onConfirm(): void };
}

/** Received cash as paise, or null while the box is empty or not a rupee amount. */
function receivedPaise(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  try {
    return toPaise(trimmed);
  } catch {
    return null;
  }
}

/** Keeps digits and the first decimal point with at most two digits after it: '1,000' -> '1000'. */
function cleanRupees(text: string): string {
  const [whole, ...rest] = text.replace(/[^\d.]/g, "").split(".");
  return rest.length === 0 ? whole : `${whole}.${rest.join("").slice(0, 2)}`;
}

/**
 * Step 3 - Pay and print (Design Book 9.5, counter mockup `#counter-pay`): one payment for the whole order, cash with
 * the change to return, or UPI with the temple's QR. UPI is switched off with a reason when the counter has no UPI id.
 * Plan A4P-2: the amount to pay and the change count to their values (screen readers hear only the final amount).
 */
export function PayStep({
  totalPaise,
  receiptCount,
  payment,
  onPayment,
  upi,
  upiDisabledReason,
  upiNote,
  largeCash,
}: PayStepProps): JSX.Element {
  const upiReady = upi !== null && upiDisabledReason === null;
  const received = receivedPaise(payment.cashReceived);
  const change = received === null ? null : received - totalPaise;

  return (
    <section aria-label={COUNTER_TEXT.payTitle.en} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Bilingual as="h2" en={COUNTER_TEXT.payTitle.en} kn={COUNTER_TEXT.payTitle.kn} className="text-(length:--text-h1)" />
        <Bilingual en={COUNTER_TEXT.payHint.en} kn={COUNTER_TEXT.payHint.kn} className="meta" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-[16px] bg-(--secondary) p-6">
        <div className="flex flex-col gap-1">
          <Bilingual en={COUNTER_TEXT.toPay.en} kn={COUNTER_TEXT.toPay.kn} className="text-(length:--text-meta) font-semibold" />
          <span className="amount text-[52px] leading-[1.05] font-bold tracking-[-0.02em]">
            <AnimatedNumber value={totalPaise} format={countingRupees(totalPaise)} />
          </span>
          <span className="meta">{toPayText(totalPaise, receiptCount)}</span>
        </div>
        <Segmented<"cash" | "upi">
          name="counter-pay-mode"
          label={COUNTER_TEXT.paymentMode}
          value={payment.mode}
          onChange={(mode) => onPayment({ mode })}
          options={[
            { value: "cash", en: COUNTER_TEXT.cash.en, kn: COUNTER_TEXT.cash.kn },
            { value: "upi", en: COUNTER_TEXT.upi.en, kn: COUNTER_TEXT.upi.kn, disabled: !upiReady },
          ]}
        />
      </div>

      {!upiReady ? (
        <Bilingual as="div" en={COUNTER_TEXT.upiNotSetUp.en} kn={COUNTER_TEXT.upiNotSetUp.kn} className="meta" />
      ) : null}

      {payment.mode === "upi" && upiReady && upi ? (
        <UpiPanel
          upi={upi}
          totalPaise={totalPaise}
          note={upiNote}
          refLast6={payment.upiRefLast6}
          seenConfirmed={payment.upiSeenConfirmed}
          onRef={(upiRefLast6) => onPayment({ upiRefLast6 })}
          onSeen={(upiSeenConfirmed) => onPayment({ upiSeenConfirmed })}
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 max-sm:grid-cols-1">
          <div className="flex flex-col gap-1.5">
            <Bilingual
              as="label"
              htmlFor="counter-cash-received"
              en={COUNTER_TEXT.received.en}
              kn={COUNTER_TEXT.received.kn}
              className="text-(length:--text-meta) font-semibold"
            />
            <div className="relative">
              <span aria-hidden="true" className="absolute top-1/2 left-4 -translate-y-1/2 text-(--muted-foreground)">
                Rs
              </span>
              <input
                id="counter-cash-received"
                data-zone="pay"
                className={`${sevaControlClass} amount h-[54px] pl-12 text-(length:--text-body-lg)`}
                inputMode="decimal"
                autoComplete="off"
                aria-describedby="counter-cash-hint"
                value={payment.cashReceived}
                // Digits and one decimal point only, so the amount always parses the same way here and in the payload.
                onChange={(e) => onPayment({ cashReceived: cleanRupees(e.target.value) })}
              />
            </div>
            <span id="counter-cash-hint" className="meta">
              {COUNTER_TEXT.receivedHint.en}
            </span>
          </div>
          <div className="flex flex-col gap-1.5" aria-live="polite">
            {change !== null && change >= 0 ? (
              <>
                <Bilingual en={COUNTER_TEXT.returnChange.en} kn={COUNTER_TEXT.returnChange.kn} className="text-(length:--text-meta) font-semibold" />
                <span className="amount text-(length:--text-h1) leading-[46px] font-bold" data-testid="counter-change">
                  <AnimatedNumber value={change} format={countingRupees(change)} />
                </span>
              </>
            ) : change !== null ? (
              <>
                <Bilingual en={COUNTER_TEXT.short.en} kn={COUNTER_TEXT.short.kn} className="text-(length:--text-meta) font-semibold text-(--destructive)" />
                <span className="amount text-(length:--text-h1) leading-[46px] font-bold text-(--destructive)">
                  <AnimatedNumber value={-change} format={countingRupees(-change)} />
                </span>
              </>
            ) : null}
          </div>
        </div>
      )}

      {payment.mode === "cash" && largeCash.required ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-control) bg-(--attn-soft) px-4 py-3">
          <Bilingual en={COUNTER_TEXT.largeCash.en} kn={COUNTER_TEXT.largeCash.kn} />
          {largeCash.confirmed ? (
            <Bilingual en={COUNTER_TEXT.largeCashConfirmed.en} kn={COUNTER_TEXT.largeCashConfirmed.kn} className="font-semibold" />
          ) : (
            <Button type="button" variant="seva-secondary" size="sm" onClick={largeCash.onConfirm}>
              {COUNTER_TEXT.confirmLargeCash.en}
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default PayStep;
