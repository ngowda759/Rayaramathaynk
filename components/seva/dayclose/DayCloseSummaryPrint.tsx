"use client";

import { createElement, type JSX } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { clearPrintJob, PRINT_ROOT_ID } from "@/lib/seva/print/printSlips";
import { formatSevaDate } from "@/lib/seva/time";
import { DAYCLOSE, extraBy, gapsLine, seriesLine, shortBy } from "@/lib/seva/strings/dayclose";
import type { Bi } from "@/lib/seva/strings/common";
import type { DayClosePrep } from "@/types/seva-dayclose";
import { cashDifference, formatAmount, type CashDifference } from "./CashCount";
import { rangeText } from "./SeriesSummary";

/**
 * The printed day-close summary (DB §9.10 step 6): print-styled HTML rendered into the page's PrintRoot and printed
 * with window.print(). DB §9.10 leaves A4 or slips to the printer test (UNVERIFIED); until that test it prints on the
 * slip paper the counter already uses (styles/seva/print.css sets the 99 x 210 mm page), flowing onto more slips when
 * long. Pure black on white, like the slip.
 */

export interface DayCloseSummaryModel {
  counterName: string;
  businessDate: string;
  /** ISO time of the close. */
  closedAt: string;
  /** 'Lakshmi R (23)'. */
  closedBy: string;
  receipts: number;
  cancelled: number;
  changed: number;
  openingFloatPaise: number;
  cashExpectedPaise: number;
  cashCountedPaise: number;
  /** Only rows with a count. */
  counts: { kind: "note" | "coin"; valuePaise: number; count: number }[];
  upiCount: number;
  upiExpectedPaise: number;
  upiBankTotalPaise: number | null;
  note: string | null;
  seriesRanges: DayClosePrep["seriesRanges"];
}

function istTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(iso))
    .toUpperCase();
}

function diffText(diff: CashDifference): Bi {
  if (diff.kind === "balanced") return DAYCLOSE.matches;
  const rupees = formatAmount(diff.paise);
  return diff.kind === "short" ? shortBy(rupees) : extraBy(rupees);
}

function Row({ label, value }: { label: Bi; value: string | Bi }): JSX.Element {
  return (
    <tr>
      <td className="py-[0.6mm] align-top">
        <Bilingual en={label.en} kn={label.kn} />
      </td>
      <td className="py-[0.6mm] text-right align-top font-bold">
        {typeof value === "string" ? value : <Bilingual en={value.en} kn={value.kn} />}
      </td>
    </tr>
  );
}

export function DayCloseSummaryPrint({ model }: { model: DayCloseSummaryModel }): JSX.Element {
  const cashDiff = cashDifference(model.cashCountedPaise, model.cashExpectedPaise);
  const upiDiff = model.upiBankTotalPaise === null ? null : cashDifference(model.upiBankTotalPaise, model.upiExpectedPaise);
  const table = "mt-[2mm] w-full border-collapse";
  const heading = "mt-[3mm] border-t-[0.4mm] border-solid border-black pt-[1.5mm] text-[11pt] font-bold";

  return (
    <div className="slip dc-summary h-auto! overflow-visible! p-[1mm]" data-testid="dc-summary">
      <div className="text-center text-[13pt] font-bold">
        <Bilingual en={DAYCLOSE.summaryTitle.en} kn={DAYCLOSE.summaryTitle.kn} />
      </div>
      <div className="mt-[1mm] text-center">
        {model.counterName} - {formatSevaDate(model.businessDate)}
      </div>
      <div className="text-center">
        {DAYCLOSE.summaryClosedBy.en}: {model.closedBy} - {istTime(model.closedAt)}
      </div>

      <table className={table}>
        <tbody>
          <Row label={DAYCLOSE.summaryReceipts} value={String(model.receipts)} />
          <Row label={DAYCLOSE.summaryCancelled} value={String(model.cancelled)} />
          <Row label={DAYCLOSE.summaryChanged} value={String(model.changed)} />
        </tbody>
      </table>

      <div className={heading}>
        <Bilingual en={DAYCLOSE.cash.en} kn={DAYCLOSE.cash.kn} />
      </div>
      <table className={table}>
        <tbody>
          {model.counts.map((c) => (
            <tr key={`${c.kind}:${c.valuePaise}`}>
              <td>
                {formatAmount(c.valuePaise)} {c.kind} x {c.count}
              </td>
              <td className="text-right">{formatAmount(c.valuePaise * c.count)}</td>
            </tr>
          ))}
          <Row label={DAYCLOSE.counted} value={formatAmount(model.cashCountedPaise)} />
          <Row label={DAYCLOSE.expectedInDrawer} value={formatAmount(model.cashExpectedPaise)} />
          <Row label={DAYCLOSE.difference} value={diffText(cashDiff)} />
        </tbody>
      </table>

      <div className={heading}>
        <Bilingual en={DAYCLOSE.upi.en} kn={DAYCLOSE.upi.kn} />
      </div>
      <table className={table}>
        <tbody>
          <Row label={DAYCLOSE.summaryUpiReceipts} value={String(model.upiCount)} />
          <Row label={DAYCLOSE.upiExpected} value={formatAmount(model.upiExpectedPaise)} />
          <Row label={DAYCLOSE.upiBankTotal} value={model.upiBankTotalPaise === null ? "-" : formatAmount(model.upiBankTotalPaise)} />
          {upiDiff ? <Row label={DAYCLOSE.difference} value={diffText(upiDiff)} /> : null}
        </tbody>
      </table>

      {model.note ? (
        <>
          <div className={heading}>
            <Bilingual en={DAYCLOSE.summaryNote.en} kn={DAYCLOSE.summaryNote.kn} />
          </div>
          <p className="mt-[1mm] whitespace-pre-wrap">{model.note}</p>
        </>
      ) : null}

      <div className={heading}>
        <Bilingual en={DAYCLOSE.numbers.en} kn={DAYCLOSE.numbers.kn} />
      </div>
      {model.seriesRanges.map((r) => {
        const counts = seriesLine({ issued: r.issued, cancelled: r.cancelled });
        const gaps = r.openGaps === 0 ? DAYCLOSE.noGaps : gapsLine(r.openGaps);
        return (
          <div key={r.series} className="mt-[1.5mm]">
            <div className="font-bold">{rangeText(r.first, r.last) ?? `${r.series}: -`}</div>
            <Bilingual as="div" en={counts.en} kn={counts.kn} />
            <Bilingual as="div" en={gaps.en} kn={gaps.kn} />
          </div>
        );
      })}

      <div className="mt-[10mm] border-t-[0.3mm] border-solid border-black pt-[1mm]">
        <Bilingual en={DAYCLOSE.summarySignature.en} kn={DAYCLOSE.summarySignature.kn} />
      </div>
    </div>
  );
}

interface SummaryJob {
  root: Root;
  node: HTMLElement;
  onAfterPrint: () => void;
}

let currentJob: SummaryJob | null = null;

function clearSummaryJob(): void {
  const job = currentJob;
  if (!job) return;
  currentJob = null;
  window.removeEventListener("afterprint", job.onAfterPrint);
  job.root.unmount();
  job.node.remove();
}

/**
 * Prints the summary in one job: removes any slips or earlier summary still in the PrintRoot, renders this one, waits
 * for the fonts, then calls window.print(). The summary stays in the root until 'afterprint'.
 */
export async function printDayCloseSummary(model: DayCloseSummaryModel): Promise<void> {
  clearPrintJob();
  clearSummaryJob();
  const host = document.getElementById(PRINT_ROOT_ID);
  if (!host) throw new Error("seva_print_root_missing");

  const node = document.createElement("div");
  node.className = "dc-summary-job";
  host.appendChild(node);
  const root = createRoot(node);
  const job: SummaryJob = { root, node, onAfterPrint: () => undefined };
  job.onAfterPrint = () => {
    if (currentJob === job) clearSummaryJob();
  };
  currentJob = job;

  flushSync(() => {
    root.render(createElement(DayCloseSummaryPrint, { model }));
  });
  if ("fonts" in document && document.fonts) await document.fonts.ready;
  if (currentJob !== job) return;

  window.addEventListener("afterprint", job.onAfterPrint);
  window.print();
}

export default DayCloseSummaryPrint;
