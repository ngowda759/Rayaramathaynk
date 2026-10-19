/**
 * Keeps the counter's Excel copy up to date (Design Book 9.11): the day's file is rewritten when something changed,
 * at most every 30 s, at once after every 20 new receipts, and on `flushNow` (day close, "Save Excel now").
 * The workbook itself is built by the injected `build` (the Web Worker in `download.ts` on the counter); rows come from
 * the PC's local receipts through `getRows`, so online and offline receipts are both in the copy.
 */
import { businessDate, istParts } from '@/lib/seva/time';
import type { IssuedReceipt } from '@/types/seva';
import type { ExportIncomeLedger, ExportReceiptRow } from '@/types/seva-export';
import { folderWriteStatus, writeDayCopy, type FolderDb, type FolderStatus } from './folder';

export const EXCEL_COPY_INTERVAL_MS = 30_000;
export const EXCEL_COPY_RECEIPTS = 20;

export type ExcelCopyStatus = FolderStatus | 'written';

export interface ExcelCopySchedulerDeps {
  db: FolderDb;
  getRows(date: string): Promise<ExportReceiptRow[]>;
  /** Builds the day's workbook; `date` is the business date the rows belong to. */
  build(rows: ExportReceiptRow[], date: string): Promise<ArrayBuffer>;
  clock: () => Date;
  onStatus(s: ExcelCopyStatus): void;
  /** A write that failed for another reason (for example the file is open in Excel); the change is kept and retried. */
  onError?(err: unknown): void;
}

export interface ExcelCopyScheduler {
  /** Tells the scheduler that `n` receipts were saved or changed (a cancel counts as a change with n = 0). */
  noteReceipts(n: number): void;
  /** Writes today's file (and any day still waiting) now. */
  flushNow(): Promise<void>;
  stop(): void;
}

export function createExcelCopyScheduler(deps: ExcelCopySchedulerDeps): ExcelCopyScheduler {
  /** Business dates with changes not yet on disk; a day stays here until its file is written. */
  const dirtyDates = new Set<string>();
  let receiptsSinceWrite = 0;
  let stopped = false;
  /** Writes run one after another, never two at once. */
  let chain: Promise<void> = Promise.resolve();

  async function writeDate(date: string): Promise<boolean> {
    const rows = await deps.getRows(date);
    const bytes = await deps.build(rows, date);
    const result = await writeDayCopy(deps.db, date, bytes);
    deps.onStatus(result);
    return result === 'written';
  }

  async function write(force: boolean): Promise<void> {
    const today = businessDate(deps.clock());
    if (!force && dirtyDates.size === 0) return;
    const dates = new Set(dirtyDates);
    if (force) dates.add(today);

    // Ask the folder first, so nothing is built when it cannot be written.
    const ready = await folderWriteStatus(deps.db);
    if (ready !== 'ready') {
      deps.onStatus(ready);
      return;
    }
    const noted = receiptsSinceWrite;
    try {
      for (const date of [...dates].sort()) {
        // A change noted while this write runs re-marks the day after the delete below, so it is never lost.
        dirtyDates.delete(date);
        if (!(await writeDate(date))) {
          dirtyDates.add(date);
          return;
        }
      }
      receiptsSinceWrite = Math.max(0, receiptsSinceWrite - noted);
    } catch (err) {
      for (const date of dates) dirtyDates.add(date);
      deps.onError?.(err);
    }
  }

  function enqueue(force: boolean): Promise<void> {
    chain = chain.then(() => write(force));
    return chain;
  }

  const timer = setInterval(() => {
    if (!stopped && dirtyDates.size > 0) void enqueue(false);
  }, EXCEL_COPY_INTERVAL_MS);

  return {
    noteReceipts(n: number): void {
      if (stopped) return;
      dirtyDates.add(businessDate(deps.clock()));
      receiptsSinceWrite += Math.max(0, Math.trunc(n));
      if (receiptsSinceWrite >= EXCEL_COPY_RECEIPTS) void enqueue(false);
    },
    flushNow(): Promise<void> {
      return enqueue(true);
    },
    stop(): void {
      stopped = true;
      clearInterval(timer);
    },
  };
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Default Tally income ledger of a seva (C-55): 'Seva Income - <seva name>'. */
function incomeLedgerName(sevaName: string): string {
  return `Seva Income - ${sevaName}`;
}

/** 'Ramesh - 023', as on the counter strip and the slip; just the name when there is no staff number. */
function issuedByLabel(by: IssuedReceipt['issuedBy']): string {
  return by.staffNo === null ? by.name : `${by.name} - ${String(by.staffNo).padStart(3, '0')}`;
}

/**
 * A receipt kept on the counter PC as a row of the day's Excel copy. The devotee phone is never copied (C-16): the
 * day copy has no phone column, and the row is built field by field so nothing else slips through.
 */
export function issuedToExportRow(r: IssuedReceipt): ExportReceiptRow {
  const issuedAt = new Date(r.issuedAt);
  const ist = istParts(issuedAt);
  const codes: string[] = [];
  const ledgers: ExportIncomeLedger[] = [];
  for (const line of r.lines) {
    if (line.code && !codes.includes(line.code)) codes.push(line.code);
    const ledger = incomeLedgerName(line.nameEn);
    const existing = ledgers.find((l) => l.ledger === ledger);
    if (existing) existing.amountPaise += line.amountPaise;
    else ledgers.push({ ledger, amountPaise: line.amountPaise });
  }
  return {
    receiptNo: r.receiptNo,
    series: r.seriesCode,
    date: businessDate(issuedAt),
    time: `${pad2(ist.hour)}:${pad2(ist.minute)}`,
    devoteeName: r.devotee.name,
    sevas: r.lines.map((l) => (l.quantity > 1 ? `${l.nameEn} x ${l.quantity}` : l.nameEn)).join(', '),
    amountPaise: r.totalPaise,
    mode: r.payment.mode,
    status: r.status,
    gotra: r.devotee.gotra ?? '',
    nakshatra: r.devotee.nakshatra ?? '',
    rashi: r.devotee.rashi ?? '',
    sevaCodes: codes.join(', '),
    upiRefLast6: r.payment.upiRefLast6 ?? '',
    issuedBy: issuedByLabel(r.issuedBy),
    prasadam: r.prasadam,
    changed: r.lines.some((l) => l.changed),
    cancelReason: '',
    incomeLedgers: ledgers,
  };
}
