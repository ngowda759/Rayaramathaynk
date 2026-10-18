/**
 * Offline (OF) receipt numbers and offline group numbers, taken on this PC (Design Book 8.3, C-19).
 *
 * Each counter lives in the `meta` store as the last number used: `of:<series>:<year>` for receipt numbers and
 * `ofg:<series>:<yymm>` for group numbers. Every take is one read-write transaction, and IndexedDB runs read-write
 * transactions on the same store one after another, so two tabs (or two saves) never share a number. The server's
 * last OF number (bootstrap and heartbeat) and its last offline group number of the month (heartbeat) only ever raise
 * the PC's counters - which is what keeps a PC that replaced another from repeating a number or a group label.
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

function assertYymm(yymm: string): void {
  if (!YYMM_PATTERN.test(yymm)) throw new RangeError('invalid_yymm');
}

function assertLastNo(n: number, max: number): void {
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new RangeError('invalid_last_no');
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
  assertYymm(p.yymm);
  const n = await takeFromCounter(meta, groupKey(p.series, p.yymm), 1);
  return formatOfflineGroupNo({ yymm: p.yymm, series: p.series, n });
}

/** Takes `count` consecutive OF numbers for the series and calendar year; returns the first running number. */
export async function takeOfflineNumbers(db: SevaDb, p: { series: string; year: number; count: number }): Promise<number> {
  const tx = db.transaction('meta', 'readwrite');
  return runTransaction(tx, () => takeRunningNumbers(tx.store, p));
}

/** In one read-write transaction: raises a counter in `meta` to `serverLastNo` when that is higher; never lowers it. */
async function raiseCounter(db: SevaDb, key: string, serverLastNo: number): Promise<void> {
  const tx = db.transaction('meta', 'readwrite');
  await runTransaction(tx, async () => {
    const last = readLast(await tx.store.get(key), key);
    if (serverLastNo > last) await tx.store.put(serverLastNo, key);
  });
}

/** Sets this PC's last OF number to the server's when the server's is higher; never lowers it. */
export async function raiseOfflineFloor(db: SevaDb, p: { series: string; year: number; serverLastNo: number }): Promise<void> {
  assertSeries(p.series);
  assertYear(p.year);
  assertLastNo(p.serverLastNo, MAX_RUNNING_NO);
  await raiseCounter(db, ofKey(p.series, p.year), p.serverLastNo);
}

/**
 * Sets this PC's last offline group number for the series and IST month ('YYMM') to the office's when the office's is
 * higher; never lowers it. After "Replace this PC" the new PC's group counter is empty: without this it would start
 * again at 001 and repeat a label the office already holds, and that order's sync would be refused (group_no is
 * unique).
 */
export async function raiseOfflineGroupFloor(
  db: SevaDb,
  p: { series: string; yymm: string; serverLastNo: number },
): Promise<void> {
  assertSeries(p.series);
  assertYymm(p.yymm);
  assertLastNo(p.serverLastNo, Number.MAX_SAFE_INTEGER);
  await raiseCounter(db, groupKey(p.series, p.yymm), p.serverLastNo);
}

/** The next offline group number for the series and IST month ('YYMM'). */
export async function takeOfflineGroupNo(db: SevaDb, p: { yymm: string; series: string }): Promise<string> {
  const tx = db.transaction('meta', 'readwrite');
  return runTransaction(tx, () => takeGroupNumber(tx.store, p));
}
