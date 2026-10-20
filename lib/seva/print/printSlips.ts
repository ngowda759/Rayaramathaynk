/**
 * The print job (Design Book 9.8, 10.2): one job, one page per slip. Renders the slips into the page's PrintRoot
 * (#seva-print-root), waits for the fonts and every header photo, sets the page size for the configured paper (plan
 * A4S-7), then calls window.print() - under kiosk printing that goes straight to the default printer.
 *
 * Page size: `@page { size: <w>mm <h>mm; margin: 0 }` goes into a <style> on the page only while a job is in the root,
 * so other printouts (the board summary on A4) keep their own. A roll slip is measured first and its page is its
 * content height plus the tear margin; each slip of a multi-date receipt gets its own named page. A fixed-sheet slip
 * whose content would overflow is shrunk to fit rather than clipped.
 *
 * The slips stay in the root until the window's 'afterprint' event, or until the next print starts, so a test can
 * render the page to PDF after this resolves.
 */
import { createElement, Fragment } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import { ReceiptSlip } from "@/components/seva/slip/ReceiptSlip";

import { fitScale, pageRule, pageSizeCss, pxToMm, rollPageHeightMm, slipBox, type PaperSpec } from "./paper";
import type { SlipModel } from "./slip-model";

export const PRINT_ROOT_ID = "seva-print-root";

const NL = "\n";

/** The <style> that carries the job's @page rules. */
export const PRINT_PAGE_STYLE_ID = "seva-print-page";

/** Puts the job's page rules on the page, replacing any earlier ones. */
export function setPrintPageStyle(css: string): void {
  let style = document.getElementById(PRINT_PAGE_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = PRINT_PAGE_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = ["@media print {", css, "}"].join(NL);
}

/** Removes the job's page rules. */
export function clearPrintPageStyle(): void {
  document.getElementById(PRINT_PAGE_STYLE_ID)?.remove();
}

/**
 * Lays the print root out at full size, out of sight, for `measure` - the root is hidden on screen otherwise - and
 * hides it again after.
 */
export function measureInPrintRoot<T>(host: HTMLElement, measure: () => T): T {
  host.classList.add("seva-print-measure");
  try {
    return measure();
  } finally {
    host.classList.remove("seva-print-measure");
  }
}

/**
 * The page rules for the rendered slips: one fitted, named page per roll slip (with the tallest as the fallback
 * size), or the fixed sheet with any overflowing slip shrunk to fit.
 */
function preparePages(host: HTMLElement, node: HTMLElement, paper: PaperSpec): string {
  const slips = Array.from(node.querySelectorAll<HTMLElement>(":scope > .slip"));
  return measureInPrintRoot(host, () => {
    if (paper.roll) {
      const heights = slips.map((el) => rollPageHeightMm(el.getBoundingClientRect().height, paper.widthMm));
      const rules = heights.map((h, i) => {
        const name = `seva-slip-${i}`;
        slips[i].dataset.page = name;
        return [pageRule(paper.widthMm, h, { name }), `.slip[data-page="${name}"] { page: ${name}; }`].join(NL);
      });
      return [pageSizeCss(paper, Math.max(paper.widthMm, ...heights)), ...rules].join(NL);
    }
    const box = slipBox(paper).heightMm ?? 0;
    for (const el of slips) {
      const scale = fitScale(pxToMm(el.scrollHeight), pxToMm(el.clientHeight) || box);
      if (scale < 1) {
        el.dataset.fit = "shrunk";
        el.style.setProperty("--slip-fit", scale.toFixed(3));
      }
    }
    return pageSizeCss(paper);
  });
}

/** A photo that never answers must not hold the counter: print without it after this long. */
const IMAGE_WAIT_MS = 5000;

interface PrintJob {
  root: Root;
  node: HTMLElement;
  onAfterPrint: () => void;
}

let current: PrintJob | null = null;

/** Removes the slips of the last job, if any. */
export function clearPrintJob(): void {
  const job = current;
  if (!job) return;
  current = null;
  window.removeEventListener("afterprint", job.onAfterPrint);
  job.root.unmount();
  job.node.remove();
  clearPrintPageStyle();
}

function waitForImage(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = (): void => {
      img.removeEventListener("load", done);
      img.removeEventListener("error", done);
      resolve();
    };
    img.addEventListener("load", done);
    img.addEventListener("error", done);
  });
}

async function waitForImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll("img"));
  if (images.length === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cap = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, IMAGE_WAIT_MS);
  });
  try {
    await Promise.race([Promise.all(images.map(waitForImage)).then(() => undefined), cap]);
  } finally {
    clearTimeout(timer);
  }
}

async function waitForFonts(): Promise<void> {
  if ("fonts" in document && document.fonts) {
    await document.fonts.ready;
  }
}

/** Prints the slips in one job, one page each. Needs a mounted PrintRoot on the page. */
export async function printSlips(models: SlipModel[]): Promise<void> {
  clearPrintJob();
  if (models.length === 0) return;

  const host = document.getElementById(PRINT_ROOT_ID);
  if (!host) throw new Error("seva_print_root_missing");

  const node = document.createElement("div");
  node.className = "slip-job";
  host.appendChild(node);
  const root = createRoot(node);
  const job: PrintJob = { root, node, onAfterPrint: () => undefined };
  job.onAfterPrint = () => {
    if (current === job) clearPrintJob();
  };
  current = job;

  flushSync(() => {
    root.render(
      createElement(
        Fragment,
        null,
        models.map((model, i) => createElement(ReceiptSlip, { key: `${i}-${model.receiptNo}`, model })),
      ),
    );
  });

  await waitForFonts();
  await waitForImages(node);
  if (current !== job) return; // a newer job replaced this one while it waited

  // Every slip of one job comes from the same settings, so they share one paper.
  setPrintPageStyle(preparePages(host, node, models[0].paper));
  window.addEventListener("afterprint", job.onAfterPrint);
  window.print();
}
