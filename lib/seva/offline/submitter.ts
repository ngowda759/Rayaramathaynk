/**
 * Saves a counter order online, or offline with this PC's own OF numbers (Design Book 8.3, 8.6, 9.11).
 *
 * - "Work offline" on: straight to an offline save.
 * - Otherwise the office gets the order with a 6-second limit per attempt. A timeout, a network failure or a server
 *   failure (5xx) is tried twice more with the SAME clientOrderId (the server returns the stored order if an earlier
 *   attempt got through). Any 4xx answer is a business answer (rate changed, seva switched off, not allowed ...): it
 *   is thrown to the caller and never printed offline.
 * - After three failed attempts the receptionist is asked whether to print offline. No -> nothing is kept.
 * - An offline save is a NEW order: new clientOrderId, new client receipt ids and new QR tokens (the office may hold
 *   the in-doubt online order under the old ones, and both are unique there). When an online attempt was made, the
 *   old clientOrderId is recorded as `supersedesClientOrderId` so the office can cancel that order if it was never
 *   printed (C-53).
 *
 * The OF numbers, the group number, the outbox item and the local receipt copies are written in ONE IndexedDB
 * transaction, so either the whole offline order exists on this PC or none of it does and no number is used up.
 * Month and year in OF numbers come from this PC's clock in IST.
 *
 * Keep the same clientOrderId when the receptionist retries the same order after a "cancelled" result.
 */
import { GOTRAS } from '@/lib/seva/domain/gotras';
import { NAKSHATRAS } from '@/lib/seva/domain/nakshatras';
import { findOption } from '@/lib/seva/domain/options';
import { RASHIS } from '@/lib/seva/domain/rashis';
import { formatReceiptNo } from '@/lib/seva/numbering';
import { newQrToken } from '@/lib/seva/qr';
import { istParts } from '@/lib/seva/time';
import type {
  CatalogueSeva,
  CounterBootstrap,
  CounterLineInput,
  CounterOrderPayload,
  CounterReceiptInput,
  DevoteeInput,
  IssuedReceipt,
  IssueResponse,
  OfflineOrderPayload,
} from '@/types/seva';
import { takeGroupNumber, takeRunningNumbers } from './allocator';
import { connectionStore, isUnreachable } from './connection';
import { runTransaction, type SevaDb } from './db';
import { putLocalReceipt, rememberReceipts } from './local-receipts';
import { putOutboxItem, refreshWaiting } from './outbox';

export const ONLINE_TIMEOUT_MS = 6000;
export const ONLINE_ATTEMPTS = 3;

/** The years seva_receipts accepts (DB 7.4); a PC clock outside them is wrong. */
const MIN_YEAR = 2026;
const MAX_YEAR = 2100;

export type SubmitResult = { mode: 'online' | 'offline'; receipts: IssuedReceipt[] } | { mode: 'cancelled' };

export interface CounterSubmitterDeps {
  db: SevaDb;
  api: { issue(p: CounterOrderPayload): Promise<IssueResponse> };
  clock: () => Date;
  askPrintOffline: () => Promise<boolean>;
  staff: () => { name: string; staffNo: number };
  counter: () => { name: string; offlineSeries: string };
  catalogue: () => CounterBootstrap;
  isForcedOffline: () => boolean;
  newIds: () => { clientOrderId: string };
}

export type OfflineIssueCode =
  | 'offline_unknown_seva'
  | 'offline_amount_missing'
  | 'offline_total_mismatch'
  | 'offline_clock_invalid'
  | 'offline_empty_order';

/** Why an order could not be printed offline. Nothing was kept and no number was used. */
export class OfflineIssueError extends Error {
  constructor(public code: OfflineIssueCode) {
    super(code);
    this.name = 'OfflineIssueError';
  }
}

/** Same shape as the http client's timeout: code 'timeout', status 0. */
class OnlineTimeoutError extends Error {
  readonly code = 'timeout';
  readonly status = 0;
  constructor() {
    super('timeout');
    this.name = 'OnlineTimeoutError';
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new OnlineTimeoutError()), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** An RFC 4122 version 4 id from crypto.getRandomValues. */
function newClientId(): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

interface PricedLine {
  input: CounterLineInput;
  seva: CatalogueSeva;
  unitRatePaise: number;
  amountPaise: number;
  changed: boolean;
}

interface PricedReceipt {
  input: CounterReceiptInput;
  lines: PricedLine[];
  totalPaise: number;
}

/**
 * Prices the order from the cached catalogue the counter showed: the line's own rate when it was changed or is an
 * any-amount seva, else the catalogue rate. Receipts come back in seva-date order (as the office numbers them).
 */
function priceOrder(p: CounterOrderPayload, catalogue: readonly CatalogueSeva[]): { receipts: PricedReceipt[]; totalPaise: number } {
  if (p.receipts.length === 0) throw new OfflineIssueError('offline_empty_order');
  const byId = new Map(catalogue.map((s) => [s.id, s]));
  const receipts = p.receipts.map((input): PricedReceipt => {
    const lines = input.lines.map((line): PricedLine => {
      const seva = byId.get(line.sevaId);
      if (!seva) throw new OfflineIssueError('offline_unknown_seva');
      const rate = line.unitRatePaise ?? seva.ratePaise;
      if (rate === null || !Number.isSafeInteger(rate) || rate <= 0) throw new OfflineIssueError('offline_amount_missing');
      if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new RangeError('invalid_quantity');
      return {
        input: line,
        seva,
        unitRatePaise: rate,
        amountPaise: rate * line.quantity,
        changed: seva.ratePaise !== null && line.unitRatePaise !== undefined && line.unitRatePaise !== seva.ratePaise,
      };
    });
    if (lines.length === 0) throw new OfflineIssueError('offline_empty_order');
    return { input, lines, totalPaise: lines.reduce((sum, l) => sum + l.amountPaise, 0) };
  });
  const totalPaise = receipts.reduce((sum, r) => sum + r.totalPaise, 0);
  // The slip must show what the receptionist saw and took; a different total is never printed.
  if (totalPaise !== p.expectedTotalPaise) throw new OfflineIssueError('offline_total_mismatch');
  receipts.sort((a, b) => (a.input.sevaDate < b.input.sevaDate ? -1 : a.input.sevaDate > b.input.sevaDate ? 1 : 0));
  return { receipts, totalPaise };
}

/** Devotee details as printed: English names from the pick lists, Kannada under them. Never the phone. */
function slipDevotee(d: DevoteeInput): IssuedReceipt['devotee'] {
  const out: IssuedReceipt['devotee'] = { name: d.name.trim() };
  if (d.gotra) {
    const option = findOption(GOTRAS, d.gotra.id);
    const text = d.gotra.text.trim() || option?.en;
    if (text) out.gotra = text;
    if (option) out.gotraKn = option.kn;
  }
  if (d.nakshatra) {
    const option = findOption(NAKSHATRAS, d.nakshatra.id);
    const text = option?.en ?? d.nakshatra.text?.trim();
    if (text) out.nakshatra = text;
    if (option) out.nakshatraKn = option.kn;
  }
  if (d.rashi) {
    const option = findOption(RASHIS, d.rashi.id);
    const text = option?.en ?? d.rashi.text?.trim();
    if (text) out.rashi = text;
    if (option) out.rashiKn = option.kn;
  }
  return out;
}

function slipPayment(payment: CounterOrderPayload['payment']): IssuedReceipt['payment'] {
  return payment.mode === 'upi' && payment.upiRefLast6 !== undefined
    ? { mode: 'upi', upiRefLast6: payment.upiRefLast6 }
    : { mode: payment.mode };
}

async function issueOffline(deps: CounterSubmitterDeps, p: CounterOrderPayload, supersede: boolean): Promise<IssuedReceipt[]> {
  const now = deps.clock();
  if (Number.isNaN(now.getTime())) throw new OfflineIssueError('offline_clock_invalid');
  const { year, month } = istParts(now);
  if (year < MIN_YEAR || year > MAX_YEAR) throw new OfflineIssueError('offline_clock_invalid');

  // Everything that can fail is worked out before the transaction, which then only stores.
  const priced = priceOrder(p, deps.catalogue().catalogue);
  const counter = deps.counter();
  const staff = deps.staff();
  const series = counter.offlineSeries;
  const { clientOrderId } = deps.newIds();
  const supersedes = supersede ? p.clientOrderId : p.supersedesClientOrderId;
  const issuedAt = now.toISOString();
  const yymm = `${pad2(year % 100)}${pad2(month)}`;
  const fresh = priced.receipts.map(() => ({ clientReceiptId: newClientId(), qrToken: newQrToken() }));
  const devotee = slipDevotee(p.devotee);
  const payment = slipPayment(p.payment);
  const count = priced.receipts.length;

  const tx = deps.db.transaction(['meta', 'outbox', 'today'], 'readwrite');
  const receipts = await runTransaction(tx, async () => {
    const meta = tx.objectStore('meta');
    const first = await takeRunningNumbers(meta, { series, year, count });
    const groupNo = await takeGroupNumber(meta, { yymm, series });
    const receiptNos = priced.receipts.map((_, i) =>
      formatReceiptNo({ series, staffNo: staff.staffNo, channel: null, month, year, running: first + i }),
    );

    const payload: OfflineOrderPayload = {
      clientOrderId,
      devotee: p.devotee,
      payment: p.payment,
      expectedTotalPaise: p.expectedTotalPaise,
      ...(supersedes !== undefined ? { supersedesClientOrderId: supersedes } : {}),
      // Stored now, with the numbers it is inside: whoever is signed in when the outbox is sent may be someone else.
      issuerStaffNo: staff.staffNo,
      issuedAt,
      groupNo,
      receipts: priced.receipts.map((r, i) => ({
        clientReceiptId: fresh[i].clientReceiptId,
        sevaDate: r.input.sevaDate,
        qrToken: fresh[i].qrToken,
        runningNo: first + i,
        receiptNo: receiptNos[i],
        lines: r.lines.map((l) => ({ ...l.input, cachedRatePaise: l.seva.ratePaise })),
      })),
    };

    const issued = priced.receipts.map(
      (r, i): IssuedReceipt => ({
        id: null,
        clientReceiptId: fresh[i].clientReceiptId,
        receiptNo: receiptNos[i],
        seriesCode: series,
        sevaDate: r.input.sevaDate,
        groupNo,
        position: i + 1,
        count,
        orderTotalPaise: priced.totalPaise,
        totalPaise: r.totalPaise,
        lines: r.lines.map((l, j) => ({
          lineNo: j + 1,
          sevaId: l.seva.id,
          code: l.seva.code,
          nameEn: l.seva.nameEn,
          nameKn: l.seva.nameKn,
          quantity: l.input.quantity,
          unitRatePaise: l.unitRatePaise,
          amountPaise: l.amountPaise,
          changed: l.changed,
          prasadamItems: l.seva.prasadamItems,
        })),
        payment,
        devotee,
        qrToken: fresh[i].qrToken,
        issuedAt,
        issuedBy: { name: staff.name, staffNo: staff.staffNo },
        counterName: counter.name,
        channel: 'counter',
        issuedOffline: true,
        status: 'issued',
        printCount: 0,
        prasadam: r.lines.some((l) => l.seva.prasadamGiven) ? 'pending' : 'none',
      }),
    );

    await putOutboxItem(meta, tx.objectStore('outbox'), { kind: 'order', payload });
    const today = tx.objectStore('today');
    for (const receipt of issued) await putLocalReceipt(today, receipt, false);
    return issued;
  });

  connectionStore.markOffline(now);
  await refreshWaiting(deps.db);
  return receipts;
}

export function createCounterSubmitter(deps: CounterSubmitterDeps): { submit(p: CounterOrderPayload): Promise<SubmitResult> } {
  const inFlight = new Map<string, Promise<SubmitResult>>();

  async function submitOnce(p: CounterOrderPayload): Promise<SubmitResult> {
    if (deps.isForcedOffline()) {
      return { mode: 'offline', receipts: await issueOffline(deps, p, false) };
    }

    let answer: IssueResponse | null = null;
    for (let attempt = 1; attempt <= ONLINE_ATTEMPTS && answer === null; attempt += 1) {
      try {
        answer = await withTimeout(deps.api.issue(p), ONLINE_TIMEOUT_MS);
      } catch (err) {
        if (!isUnreachable(err)) throw err;
      }
    }

    if (answer !== null) {
      connectionStore.markOnline();
      try {
        await rememberReceipts(deps.db, answer.receipts, true);
      } catch {
        // The office already holds these receipts, so the save succeeded and the slips must print;
        // only this PC's local list misses them.
      }
      return { mode: 'online', receipts: answer.receipts };
    }

    connectionStore.markOffline(deps.clock());
    if (!(await deps.askPrintOffline())) return { mode: 'cancelled' };
    return { mode: 'offline', receipts: await issueOffline(deps, p, true) };
  }

  return {
    submit(p) {
      // A second save of the same order while the first is still running gets the first one's result.
      const running = inFlight.get(p.clientOrderId);
      if (running) return running;
      const work = submitOnce(p).finally(() => inFlight.delete(p.clientOrderId));
      inFlight.set(p.clientOrderId, work);
      return work;
    },
  };
}
