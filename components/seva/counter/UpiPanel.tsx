"use client";

import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { SlipQr } from "@/components/seva/slip/SlipQr";
import { sevaControlClass } from "@/components/ui/input";
import { buildUpiPaymentUrl } from "@/lib/receipt/upi";
import { COUNTER_TEXT, rupees } from "@/lib/seva/strings/counter";

export interface UpiPanelProps {
  /** The temple's UPI id and payee name from the counter bootstrap - never the site's default VPA. */
  upi: { vpa: string; payeeName: string };
  totalPaise: number;
  /** Transaction note inside the QR (`tn`). */
  note: string;
  refLast6: string;
  seenConfirmed: boolean;
  onRef(text: string): void;
  onSeen(on: boolean): void;
}

/**
 * UPI at the counter (Design Book 9.5): the temple's QR with the amount inside, the last 6 digits of the UPI
 * reference, and the "I saw the payment succeed" tick. Save stays disabled until both are done (selectCanSave).
 */
export function UpiPanel({ upi, totalPaise, note, refLast6, seenConfirmed, onRef, onSeen }: UpiPanelProps): JSX.Element {
  const url = buildUpiPaymentUrl({ upiId: upi.vpa, payeeName: upi.payeeName, amount: totalPaise / 100, note });
  return (
    <div className="grid grid-cols-[168px_minmax(0,1fr)] items-start gap-6 max-sm:grid-cols-1">
      <figure role="img" aria-label={COUNTER_TEXT.upiQrLabel} className="m-0 size-[168px] rounded-(--radius-control) border border-(--border) bg-white p-1 [&_svg]:size-full">
        <SlipQr url={url} />
      </figure>
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-1">
          <Bilingual en={COUNTER_TEXT.upiScan.en} kn={COUNTER_TEXT.upiScan.kn} className="meta" />
          <b className="amount text-(length:--text-h1) leading-tight font-bold">{rupees(totalPaise)}</b>
          <span className="meta">{upi.vpa}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Bilingual
            as="label"
            htmlFor="counter-upi-ref"
            en={COUNTER_TEXT.upiRef.en}
            kn={COUNTER_TEXT.upiRef.kn}
            className="text-(length:--text-meta) font-semibold"
          />
          <input
            id="counter-upi-ref"
            data-zone="pay"
            className={`${sevaControlClass} num max-w-[220px] tracking-[0.2em]`}
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={refLast6}
            onChange={(e) => onRef(e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 text-(length:--text-ui)">
          <input
            type="checkbox"
            data-zone="pay"
            className="mt-0.5 size-5 shrink-0 accent-(--primary-press)"
            checked={seenConfirmed}
            onChange={(e) => onSeen(e.target.checked)}
          />
          <Bilingual en={COUNTER_TEXT.upiSeen.en} kn={COUNTER_TEXT.upiSeen.kn} />
        </label>
      </div>
    </div>
  );
}

export default UpiPanel;
