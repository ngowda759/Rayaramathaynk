/**
 * Offline (OF) receipt numbers and offline group numbers, taken on this PC (Design Book 8.3, C-19).
 *
 * Each counter lives in the `meta` store as the last number used: `of:<series>:<year>` for receipt numbers and
 * `ofg:<series>:<yymm>` for group numbers. Every take is one read-write transaction, and IndexedDB runs read-write
 * transactions on the same store one after another, so two tabs (or two saves) never share a number. The server's
 * last OF number (bootstrap and heartbeat) only ever raises the PC's counter.
 */
import { formatOfflineGroupNo } from '@/lib/seva/numbering';
import { runTransaction, type SevaDb, type SevaStoreName, type WritableStore } from './db';

/** The receipt_series_years / seva_receipts limits (DB 7.3). */
const MAX_RUNNING_NO = 999_999;
const MIN_YEAR = 2026;
const MAX_YEAR = 2100;
const SERIES_PATTERN = /^OF[0-9]{1,2}$/;
const YYMM_PATTERN = /^[0-9]{2}(0[1-9]|1[0-2])$/;

type MetaStore<T extends ArrayLike<SevaStoreName>> = WritableStore<'meta', T>;

function assertSeries(series: string): void {
  if (!SERIES_PATTERN.test(series)) throw new RangeError('invalid_offline_series');
}

function assertYear(year: number): void {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) throw new RangeError('invalid_year');
}

function readLast(value: unknown, key: string): number {
  if (value === undefined) return 0;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  // Never guess a number: a damaged counter stops offline issuing instead of risking a repeat.
  throw new Error(`offline_counter_damaged:${key}`);
}

/** Takes `count` consecutive values from a counter in `meta`; returns the first. */
export async function takeFromCounter<T extends ArrayLike<SevaStoreName>>(
  meta: MetaStore<T>,
  key: string,
  count: number,
  max = Number.MAX_SAFE_INTEGER,
): Promise<number> {
  if (!Number.isSafeInteger(count) || count < 1) throw new RangeError('invalid_count');
  const last = readLast(await meta.get(key), key);
  if (last + count > max) throw new RangeError('counter_full');
  await meta.put(last + count, key);
  return last + 1;
}

const ofKey = (series: string, year: number): string => `of:${series}:${year}`;
const groupKey = (series: string, yymm: string): string => `ofg:${series}:${yymm}`;

/** Inside a caller's transaction: takes `count` OF running numbers; returns the first. */
export async function takeRunningNumbers<T extends ArrayLike<SevaStoreName>>(
  meta: MetaStore<T>,
  p: { series: string; year: number; count: number },
): Promise<number> {
  assertSeries(p.series);
  assertYear(p.year);
  return takeFromCounter(meta, ofKey(p.series, p.year), p.count, MAX_RUNNING_NO);
}

/** Inside a caller's transaction: the next offline group number, e.g. 'G-2610-OF1-007'. */
export async function takeGroupNumber<T extends ArrayLike<SevaStoreName>>(
  meta: MetaStore<T>,
  p: { yymm: string; series: string },
): Promise<string> {
  assertSeries(p.series);
  if (!YYMM_PATTERN.test(p.yymm)) throw new RangeError('invalid_yymm');
  const n = await takeFromCounter(meta, groupKey(p.series, p.yymm), 1);
  return formatOfflineGroupNo({ yymm: p.yymm, series: p.series, n });
}

/** Takes `count` consecutive OF numbers for the series and calendar year; returns the first running number. */
export async function takeOfflineNumbers(db: SevaDb, p: { series: string; year: number; count: number }): Promise<number> {
  const tx = db.transaction('meta', 'readwrite');
  return runTransaction(tx, () => takeRunningNumbers(tx.store, p));
}

/** Sets this PC's last OF number to the server's when the server's is higher; never lowers it. */
export async function raiseOfflineFloor(db: SevaDb, p: { series: string; year: number; serverLastNo: number }): Promise<void> {
  assertSeries(p.series);
  assertYear(p.year);
  if (!Number.isSafeInteger(p.serverLastNo) || p.serverLastNo < 0 || p.serverLastNo > MAX_RUNNING_NO) {
    throw new RangeError('invalid_last_no');
  }
  const tx = db.transaction('meta', 'readwrite');
  await runTransaction(tx, async () => {
    const key = ofKey(p.series, p.year);
    const last = readLast(await tx.store.get(key), key);
    if (p.serverLastNo > last) await tx.store.put(p.serverLastNo, key);
  });
}

/** The next offline group number for the series and IST month ('YYMM'). */
export async function takeOfflineGroupNo(db: SevaDb, p: { yymm: string; series: string }): Promise<string> {
  const tx = db.transaction('meta', 'readwrite');
  return runTransaction(tx, () => takeGroupNumber(tx.store, p));
}
