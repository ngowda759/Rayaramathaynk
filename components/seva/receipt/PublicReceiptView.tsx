import type { JSX, ReactNode } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { formatRupees } from "@/lib/seva/money";
import { COMMON } from "@/lib/seva/strings/common";
import { PAYMENT_MODE_LABEL, RECEIPT, prasadamLabel } from "@/lib/seva/strings/receipt";
import { formatSevaDate } from "@/lib/seva/time";
import type { PublicReceipt } from "@/types/seva-receipts";

export interface PublicReceiptViewProps {
  receipt: PublicReceipt;
  /** Shown under the receipt, e.g. the prasadam shortcut for signed-in staff. */
  children?: ReactNode;
}

/**
 * What a phone camera opens from the slip's QR (DB §10.3, C-50): the printed slip's own details plus Valid or
 * Cancelled and whether prasadam was given. Every value is picked by name, so nothing else - never the phone - can
 * reach the page. Works as a Server Component (no state, no effects).
 */
export function PublicReceiptView({ receipt: r, children }: PublicReceiptViewProps): JSX.Element {
  const cancelled = r.status === "cancelled";
  const status = cancelled ? RECEIPT.cancelled : RECEIPT.valid;
  const prasadam = prasadamLabel(r.prasadam);
  const mode = PAYMENT_MODE_LABEL[r.mode];

  const details: { label: { en: string; kn: string }; value: string }[] = [
    { label: COMMON.name, value: r.devoteeName },
    ...(r.gotra ? [{ label: COMMON.gotra, value: r.gotra }] : []),
    ...(r.nakshatra ? [{ label: COMMON.nakshatra, value: r.nakshatra }] : []),
  ];

  return (
    <article
      aria-label={`${RECEIPT.title.en} ${r.receiptNo}`}
      className="mx-auto w-full max-w-md rounded-(--radius-surface) border border-(--border) bg-(--card) p-5 text-(--foreground) shadow-(--shadow-card)"
    >
      <header className="border-b border-(--border) pb-4 text-center">
        <Bilingual as="h1" en={r.templeNameEn} kn={r.templeNameKn} className="text-lg font-semibold" />
      </header>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Bilingual as="div" en={COMMON.receiptNo.en} kn={COMMON.receiptNo.kn} className="text-sm text-(--muted-foreground)" />
          <p className="font-mono text-base font-semibold break-all">{r.receiptNo}</p>
        </div>
        <span
          data-testid="public-receipt-status"
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            cancelled ? "bg-(--destructive-soft) text-(--destructive)" : "bg-(--ok-soft) text-(--foreground)"
          }`}
        >
          <Bilingual en={status.en} kn={status.kn} />
        </span>
      </div>

      <div className="mt-3">
        <Bilingual as="div" en={COMMON.sevaDate.en} kn={COMMON.sevaDate.kn} className="text-sm text-(--muted-foreground)" />
        <p className="font-semibold">{formatSevaDate(r.sevaDate)}</p>
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        {details.map((d) => (
          <div key={d.label.en} className="contents">
            <dt className="text-sm text-(--muted-foreground)">
              <Bilingual en={d.label.en} kn={d.label.kn} />
            </dt>
            <dd className="font-medium">{d.value}</dd>
          </div>
        ))}
      </dl>

      <table className="mt-4 w-full border-collapse text-sm">
        <caption className="sr-only">{RECEIPT.sevas.en}</caption>
        <tbody>
          {r.lines.map((line, i) => (
            <tr key={`${i}-${line.nameEn}`} className="border-t border-(--border)">
              <td className="py-2 pr-2">
                <Bilingual en={line.nameEn} kn={line.nameKn} />
              </td>
              <td className="py-2 pr-2 text-right whitespace-nowrap text-(--muted-foreground)">x {line.quantity}</td>
              <td className="py-2 text-right whitespace-nowrap">{formatRupees(line.amountPaise)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-(--border) font-semibold">
            <td className="py-2" colSpan={2}>
              <Bilingual en={COMMON.total.en} kn={COMMON.total.kn} />
            </td>
            <td className="py-2 text-right whitespace-nowrap">{formatRupees(r.totalPaise)}</td>
          </tr>
        </tbody>
      </table>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-(--muted-foreground)">
          <Bilingual en={RECEIPT.payment.en} kn={RECEIPT.payment.kn} />
        </dt>
        <dd>
          <Bilingual en={mode.en} kn={mode.kn} />
        </dd>
        <dt className="text-(--muted-foreground)">
          <Bilingual en={RECEIPT.prasadam.en} kn={RECEIPT.prasadam.kn} />
        </dt>
        <dd data-testid="public-receipt-prasadam">
          <Bilingual en={prasadam.en} kn={prasadam.kn} />
        </dd>
      </dl>

      {children ? <div className="mt-5">{children}</div> : null}
    </article>
  );
}

export default PublicReceiptView;
