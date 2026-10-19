"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { useReceiptPage, type SlipSource } from "@/components/seva/receipt/useReceiptPage";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { ReceiptSlip } from "@/components/seva/slip/ReceiptSlip";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { printSlips } from "@/lib/seva/print/printSlips";
import { toSlipModel } from "@/lib/seva/print/slip-model";
import { RECEIPT } from "@/lib/seva/strings/receipt";
import { counterApi } from "@/services/seva/counter.service";
import { SevaClientError } from "@/services/seva/http";
import type { ReceiptDetail } from "@/types/seva-receipts";

type PrintState = { kind: "idle" } | { kind: "printing" } | { kind: "printed" } | { kind: "error"; message: string };

interface PrintViewProps {
  receiptId: string;
  receipt: ReceiptDetail;
  slip: SlipSource | null;
  device: string | null;
  token: () => Promise<string>;
}

/**
 * Prints one slip through the counter's print rules (DB §9.8, C-22): the print is recorded first with
 * `counterApi.prints`, and its answer decides the DUPLICATE band. The server refuses what this person or PC may not
 * print - a reprint outside a receptionist's own counter and day, and since A3-FIX a FIRST print of another counter's
 * receipt (online W receipts are allowed) - and the page then shows the API's message and stays usable.
 */
function PrintView({ receiptId, receipt, slip, device, token }: PrintViewProps): JSX.Element {
  const { me } = useSevaMe();
  const [print, setPrint] = useState<PrintState>({ kind: "idle" });
  const started = useRef(false);

  const cancelled = receipt.status === "cancelled";
  const ready = !cancelled && device !== null && me?.counter != null;

  const run = useCallback(async (): Promise<void> => {
    if (!device || !me) return;
    if (!slip) {
      setPrint({ kind: "error", message: RECEIPT.slipUnavailable.en });
      return;
    }
    setPrint({ kind: "printing" });
    try {
      const answer = await counterApi(token, () => device).prints([receiptId]);
      const row = answer.receipts.find((r) => r.id === receiptId);
      const duplicate = row ? row.duplicate : receipt.printCount > 0;
      const model = toSlipModel(receipt, slip.settings, {
        siteUrl: slip.siteUrl,
        reprint: duplicate ? { at: new Date(), byStaffNo: me.staffNo } : undefined,
      });
      await printSlips([model]);
      setPrint({ kind: "printed" });
    } catch (err) {
      setPrint({ kind: "error", message: err instanceof SevaClientError ? err.message : RECEIPT.printFailed.en });
    }
  }, [device, me, slip, token, receiptId, receipt]);

  // Print once when the page opens; a ref keeps a re-run effect from recording a second print.
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    void run();
  }, [ready, run]);

  const backHref = `/admin/receipts/${encodeURIComponent(receiptId)}`;

  return (
    <div className="space-y-6">
      <Link href={backHref} className="text-(--link) underline-offset-2 hover:underline">
        <Bilingual en={RECEIPT.backToReceipt.en} kn={RECEIPT.backToReceipt.kn} />
      </Link>

      <header className="space-y-1">
        <Bilingual as="div" en={RECEIPT.title.en} kn={RECEIPT.title.kn} className="text-(--muted-foreground)" />
        <h1 className="font-mono text-xl font-semibold break-all">{receipt.receiptNo}</h1>
      </header>

      {cancelled ? (
        <Bilingual as="div" en={RECEIPT.cancelledNoPrint.en} kn={RECEIPT.cancelledNoPrint.kn} className="font-semibold" />
      ) : !ready ? (
        <Bilingual as="div" en={RECEIPT.printNeedsCounter.en} kn={RECEIPT.printNeedsCounter.kn} className="font-semibold" />
      ) : (
        <div className="space-y-3">
          {print.kind === "printing" ? (
            <div role="status" aria-live="polite">
              <Bilingual en={RECEIPT.printing.en} kn={RECEIPT.printing.kn} />
            </div>
          ) : null}
          {print.kind === "printed" ? (
            <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-3">
              <Bilingual en={RECEIPT.printed.en} kn={RECEIPT.printed.kn} />
              <Button variant="seva-secondary" size="sm" onClick={() => void run()}>
                {RECEIPT.printAgain.en}
              </Button>
            </div>
          ) : null}
          {print.kind === "error" ? (
            <div className="space-y-3 rounded-(--radius-surface) border border-(--destructive) bg-(--destructive-soft) p-4">
              <p role="alert" className="font-semibold text-(--destructive)">
                {print.message}
              </p>
              <Button variant="seva-secondary" onClick={() => void run()}>
                {RECEIPT.tryAgain.en}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {slip ? (
        <div className="overflow-x-auto">
          <ReceiptSlip model={toSlipModel(receipt, slip.settings, { siteUrl: slip.siteUrl })} />
        </div>
      ) : null}
    </div>
  );
}

function ReceiptPrintBody(): JSX.Element {
  // The folder is [receiptId], so the id arrives as params.receiptId.
  const { receiptId } = useParams<{ receiptId: string }>();
  const { state, token, reload } = useReceiptPage(receiptId);

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
        <Button variant="seva-secondary" onClick={reload}>
          {RECEIPT.tryAgain.en}
        </Button>
      </div>
    );
  }

  return (
    <PrintView receiptId={receiptId} receipt={state.receipt} slip={state.slip} device={state.device} token={token} />
  );
}

/** Prints one receipt's slip from Supabase on a registered counter PC (a reprint is the DUPLICATE slip). */
export default function ReceiptPrintPage(): JSX.Element {
  return (
    <SevaGate action="receipts.list">
      <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
        <ReceiptPrintBody />
      </div>
    </SevaGate>
  );
}
