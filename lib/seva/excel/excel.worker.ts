/**
 * Web Worker that builds the counter's day workbook off the main thread (Design Book 9.11), so writing the Excel copy
 * never stalls typing at the counter. Started by `lib/seva/excel/download.ts`; it answers each request with the
 * workbook bytes (transferred, not copied) or a plain error message.
 */
import type { ExportReceiptRow } from '@/types/seva-export';
import { buildDayWorkbook } from './workbook';

export interface DayWorkbookRequest {
  id: number;
  rows: ExportReceiptRow[];
  meta: { date: string; counterName: string };
}

export type DayWorkbookResponse =
  | { id: number; ok: true; bytes: ArrayBuffer }
  | { id: number; ok: false; message: string };

/** The few worker-scope members used here (the full WebWorker library clashes with the DOM library in one project). */
interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<DayWorkbookRequest>) => void): void;
  postMessage(message: DayWorkbookResponse, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.addEventListener('message', (event) => {
  const { id, rows, meta } = event.data;
  buildDayWorkbook(rows, meta).then(
    (bytes) => scope.postMessage({ id, ok: true, bytes }, [bytes]),
    (err: unknown) =>
      scope.postMessage({ id, ok: false, message: err instanceof Error ? err.message : 'workbook_failed' }, []),
  );
});
