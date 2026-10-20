/**
 * The counter's day workbook in the browser (Design Book 9.11): `buildDayWorkbookBytes` builds it in the Excel Web
 * Worker (falling back to the page when the worker cannot start), for the Excel copy and for "Download Excel", which
 * works any time without a chosen folder. Browser only.
 */
import type { ExportReceiptRow } from '@/types/seva-export';
import type { DayWorkbookRequest, DayWorkbookResponse } from './excel.worker';

type DayMeta = { date: string; counterName: string };

interface Pending {
  resolve(bytes: ArrayBuffer): void;
  reject(err: Error): void;
}

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function failAll(err: Error): void {
  for (const p of pending.values()) p.reject(err);
  pending.clear();
}

/** The one Excel worker of this page, started on first use; null where workers are unavailable. */
function excelWorker(): Worker | null {
  if (worker) return worker;
  if (workerBroken || typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(new URL('./excel.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    workerBroken = true;
    return null;
  }
  worker.addEventListener('message', (event: MessageEvent<DayWorkbookResponse>) => {
    const answer = event.data;
    const waiting = pending.get(answer.id);
    if (!waiting) return;
    pending.delete(answer.id);
    if (answer.ok) waiting.resolve(answer.bytes);
    else waiting.reject(new Error(answer.message));
  });
  worker.addEventListener('error', () => {
    // The worker script failed to load or crashed: use the page from now on.
    workerBroken = true;
    worker?.terminate();
    worker = null;
    failAll(new Error('excel_worker_failed'));
  });
  return worker;
}

function buildInWorker(w: Worker, rows: ExportReceiptRow[], meta: DayMeta): Promise<ArrayBuffer> {
  const id = nextId++;
  const request: DayWorkbookRequest = { id, rows, meta };
  return new Promise<ArrayBuffer>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage(request);
  });
}

async function buildOnPage(rows: ExportReceiptRow[], meta: DayMeta): Promise<ArrayBuffer> {
  const { buildDayWorkbook } = await import('./workbook');
  return buildDayWorkbook(rows, meta);
}

/** The day's workbook (Summary and Receipts, never phone numbers), built off the main thread when possible. */
export async function buildDayWorkbookBytes(rows: ExportReceiptRow[], meta: DayMeta): Promise<ArrayBuffer> {
  const w = excelWorker();
  if (w) {
    try {
      return await buildInWorker(w, rows, meta);
    } catch {
      // Fall through to the page; the copy matters more than where it is built.
    }
  }
  return buildOnPage(rows, meta);
}

/** Characters Windows does not allow in file names. */
const UNSAFE_FILE_CHARS = /[\\/:*?"<>|]+/g;

/** '<YYYY-MM-DD> <counter>.xlsx', safe as a Windows file name. */
export function dayExcelFileName(meta: DayMeta): string {
  const counter = meta.counterName.replace(UNSAFE_FILE_CHARS, ' ').replace(/\s+/g, ' ').trim();
  return counter ? `${meta.date} ${counter}.xlsx` : `${meta.date}.xlsx`;
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** "Download Excel": saves the day's workbook through the browser's downloads, no folder needed. */
export async function downloadDayExcel(rows: ExportReceiptRow[], meta: DayMeta): Promise<void> {
  const bytes = await buildDayWorkbookBytes(rows, meta);
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_TYPE }));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = dayExcelFileName(meta);
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Give the browser a moment to start the download before the object URL goes away.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
