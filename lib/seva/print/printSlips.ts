/**
 * The print job (Design Book 9.8, 10.2): one job, one page per slip. Renders the slips into the page's PrintRoot
 * (#seva-print-root), waits for the fonts and every header photo, then calls window.print() - under kiosk printing
 * that goes straight to the default printer.
 *
 * The slips stay in the root until the window's 'afterprint' event, or until the next print starts, so a test can
 * render the page to PDF after this resolves.
 */
import { createElement, Fragment } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import { ReceiptSlip } from "@/components/seva/slip/ReceiptSlip";

import type { SlipModel } from "./slip-model";

export const PRINT_ROOT_ID = "seva-print-root";

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

  window.addEventListener("afterprint", job.onAfterPrint);
  window.print();
}
