"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { JSX, ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { PrasadamShortcut } from "@/components/seva/receipt/PrasadamShortcut";
import { ReceiptHistory } from "@/components/seva/receipt/ReceiptHistory";
import { useReceiptPage, type SlipSource } from "@/components/seva/receipt/useReceiptPage";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { ReceiptSlip } from "@/components/seva/slip/ReceiptSlip";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Chip } from "@/components/seva/ui/Chip";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { formatRupees } from "@/lib/seva/money";
import { toSlipModel } from "@/lib/seva/print/slip-model";
import {
  CANCEL_REASON_LABEL,
  PAYMENT_MODE_LABEL,
  RECEIPT,
  REFUND_STATE_LABEL,
  prasadamLabel,
} from "@/lib/seva/strings/receipt";
import { businessDate } from "@/lib/seva/time";
import type { ReceiptDetail } from "@/types/seva-receipts";

const TIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function Card({
  title,
  children,
  testId,
}: {
  title: { en: string; kn: string };
  children: ReactNode;
  testId: string;
}): JSX.Element {
  return (
    <section
      data-testid={testId}
      className="space-y-2 rounded-(--radius-surface) border border-(--border) bg-(--card) p-4 shadow-(--shadow-card)"
    >
      <Bilingual as="h2" en={title.en} kn={title.kn} className="text-base font-semibold" />
      {children}
    </section>
  );
}

function SlipPreview({ receipt, slip }: { receipt: ReceiptDetail; slip: SlipSource | null }): JSX.Element {
  if (!slip) {
    return (
      <Bilingual
        as="div"
        en={RECEIPT.slipUnavailable.en}
        kn={RECEIPT.slipUnavailable.kn}
        className="text-(--muted-foreground)"
      />
    );
  }
  const model = toSlipModel(receipt, slip.settings, { siteUrl: slip.siteUrl });
  return (
    <div className="overflow-x-auto">
      <ReceiptSlip model={model} />
    </div>
  );
}

function ReceiptDetailView({ receipt, slip }: { receipt: ReceiptDetail; slip: SlipSource | null }): JSX.Element {
  const { me, can } = useSevaMe();
  const cancelled = receipt.status === "cancelled";
  const changed = receipt.lines.some((l) => l.changed);
  const mode = PAYMENT_MODE_LABEL[receipt.payment.mode];
  const prasadam = prasadamLabel(receipt.prasadam);
  const refund = REFUND_STATE_LABEL[receipt.refundState];
  const id = receipt.id;

  // A receptionist only ever sees receipts of their own counter and today (the API refuses others), so that is the
  // scope the reprint check is asked in. Hiding only: the prints API checks again.
  const scope = { receiptCounterId: me?.counter?.id, receiptBusinessDate: businessDate(new Date()) };
  const mayPrint =
    !cancelled &&
    id !== null &&
    me?.counter != null &&
    can("counter.issue") &&
    (receipt.printCount === 0 || can("receipt.reprint", scope));
  const printLabel = receipt.printCount > 0 ? RECEIPT.printDuplicate : RECEIPT.print;

  return (
    <div className="space-y-6">
      <Link href="/admin/receipts" className="text-(--link) underline-offset-2 hover:underline">
        <Bilingual en={RECEIPT.backToList.en} kn={RECEIPT.backToList.kn} />
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Bilingual as="div" en={RECEIPT.title.en} kn={RECEIPT.title.kn} className="text-(--muted-foreground)" />
          <h1 className="font-mono text-xl font-semibold break-all">{receipt.receiptNo}</h1>
          <div className="flex flex-wrap gap-2">
            <Chip tone={cancelled ? "critical" : "ok"}>{cancelled ? RECEIPT.cancelled.en : RECEIPT.valid.en}</Chip>
            {changed ? <Chip tone="attention">{RECEIPT.changed.en}</Chip> : null}
            {receipt.issuedOffline ? <Chip tone="neutral">{RECEIPT.offline.en}</Chip> : null}
            <Chip tone="neutral">
              {RECEIPT.printedTimes.en} x {receipt.printCount}
            </Chip>
          </div>
        </div>
        {mayPrint && id !== null ? (
          <Link
            href={`/admin/receipts/${encodeURIComponent(id)}/print`}
            className={buttonVariants({ variant: "seva-primary" })}
          >
            <Bilingual en={printLabel.en} kn={printLabel.kn} />
          </Link>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <SlipPreview receipt={receipt} slip={slip} />

        <div className="min-w-0 space-y-4">
          <Card title={RECEIPT.payment} testId="receipt-payment">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-(--muted-foreground)">{RECEIPT.payment.en}</dt>
              <dd>
                <Bilingual en={mode.en} kn={mode.kn} />
              </dd>
              <dt className="text-(--muted-foreground)">{RECEIPT.sevas.en}</dt>
              <dd className="font-semibold">{formatRupees(receipt.totalPaise)}</dd>
              {receipt.count > 1 ? (
                <>
                  <dt className="text-(--muted-foreground)">{RECEIPT.paidTogether.en}</dt>
                  <dd>
                    {formatRupees(receipt.orderTotalPaise)} - {receipt.position} / {receipt.count} - {receipt.groupNo}
                  </dd>
                </>
              ) : null}
              {receipt.payment.upiRefLast6 ? (
                <>
                  <dt className="text-(--muted-foreground)">{RECEIPT.upiRef.en}</dt>
                  <dd className="font-mono">{receipt.payment.upiRefLast6}</dd>
                </>
              ) : null}
              {receipt.refundState !== "none" ? (
                <>
                  <dt className="text-(--muted-foreground)">{RECEIPT.refund.en}</dt>
                  <dd>
                    <Bilingual en={refund.en} kn={refund.kn} />
                  </dd>
                </>
              ) : null}
            </dl>
          </Card>

          {receipt.cancel ? (
            <Card title={RECEIPT.cancelHeading} testId="receipt-cancel">
              <Bilingual
                as="div"
                en={CANCEL_REASON_LABEL[receipt.cancel.reasonCode].en}
                kn={CANCEL_REASON_LABEL[receipt.cancel.reasonCode].kn}
              />
              {receipt.cancel.note ? <div>&ldquo;{receipt.cancel.note}&rdquo;</div> : null}
              <div className="text-(length:--text-meta) text-(--muted-foreground)">
                <time dateTime={receipt.cancel.at}>{TIME.format(new Date(receipt.cancel.at))}</time> -{" "}
                {receipt.cancel.by}
              </div>
            </Card>
          ) : null}

          <Card title={RECEIPT.prasadam} testId="receipt-prasadam">
            <Bilingual as="div" en={prasadam.en} kn={prasadam.kn} />
            {!cancelled && receipt.prasadam === "pending" ? <PrasadamShortcut token={receipt.qrToken} /> : null}
          </Card>

          <ReceiptHistory history={receipt.history} />
        </div>
      </div>
    </div>
  );
}

function ReceiptDetailBody(): JSX.Element {
  // The folder is [receiptId], so the id arrives as params.receiptId.
  const { receiptId } = useParams<{ receiptId: string }>();
  const { state, reload } = useReceiptPage(receiptId);

  if (state.kind === "loading") {
    return (
      <div role="status" aria-live="polite" className="p-6">
        <Bilingual en={RECEIPT.loading.en} kn={RECEIPT.loading.kn} className="text-(--muted-foreground)" />
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center">
        <p role="alert" className="font-semibold">
          {state.message}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="seva-secondary" onClick={reload}>
            {RECEIPT.tryAgain.en}
          </Button>
          <Link href="/admin/receipts" className={buttonVariants({ variant: "seva-ghost" })}>
            {RECEIPT.backToList.en}
          </Link>
        </div>
      </div>
    );
  }

  return <ReceiptDetailView receipt={state.receipt} slip={state.slip} />;
}

/** One receipt from Supabase (DB §9.9, §12.3): the slip, payment, prasadam state and history, newest first. */
export default function ReceiptDetailPage(): JSX.Element {
  return (
    <SevaGate action="receipts.list">
      <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
        <ReceiptDetailBody />
      </div>
    </SevaGate>
  );
}
