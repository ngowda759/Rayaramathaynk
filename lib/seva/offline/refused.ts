/**
 * Outbox items the office refused (Design Book 8.3, 9.11; review M-5).
 *
 * - The sync records each refusal here (the code and when), next to the item, which stays in the outbox: a printed
 *   slip is never dropped silently.
 * - The counter lists them with their receipt numbers and amount and says what to do next: enter them in the paper
 *   book, then a temple admin sets the item aside on this PC with a reason.
 * - Setting aside moves the item out of the outbox into a kept record (the item, the office's code, the reason, who,
 *   when), in one transaction. The outbox count the heartbeat reports drops, so later day closes are not blocked.
 * - Both are reported to the office (A5-FIX F5-1): every refusal (`sync.refused`, listed on the dashboard's
 *   sync_refused card) and every set-aside with its reason (`sync.refused_set_aside`, which takes it off the card).
 *   A record is marked reported once the office has it; one that could not be sent is sent again on the next run.
 *
 * Records live in the `meta` store under their own key prefixes, so no IndexedDB version change is needed.
 */
import type { OutboxItem } from '@/types/seva';
import { runTransaction, type SevaDb } from './db';
import { refreshWaiting } from './outbox';

const REFUSED = 'outbox:refused:';
const SET_ASIDE = 'outbox:setAside:';
/** The same rule as every other reason in the module: at least 3 characters, counted as Array.from counts them. */
export const SET_ASIDE_REASON_MIN = 3;

interface RefusalRecord {
  seq: number;
  code: string;
  at: string;
  /** When the office was told (POST counter/refused); absent until then. */
  reportedAt?: string;
}

export interface RefusedItem {
  seq: number;
  kind: OutboxItem['kind'];
  code: string;
  refusedAt: string;
  receiptNos: string[];
  totalPaise: number;
}

export interface SetAsideRecord {
  seq: number;
  item: OutboxItem;
  code: string;
  reason: string;
  by: { name: string; staffNo: number };
  at: string;
  /** When the refusal was recorded, if it was. */
  refusedAt?: string;
  /** When the office was told (POST counter/refused/set-aside); absent until then. */
  reportedAt?: string;
}

/** What the PC tells the office about one refused item (POST counter/refused). */
export interface RefusalReport {
  seq: number;
  kind: OutboxItem['kind'];
  code: string;
  receiptNos: string[];
  totalPaise: number;
  refusedAt?: string;
}

/** What the PC tells the office when a temple admin set a refused item aside (POST counter/refused/set-aside). */
export interface SetAsideReport extends RefusalReport {
  reason: string;
  setAsideAt: string;
}

/** The two office calls the reports go through (services/seva/counter.service.ts). */
export interface RefusalReporter {
  reportRefused(items: RefusalReport[]): Promise<unknown>;
  reportSetAside(items: SetAsideReport[]): Promise<unknown>;
}

const key = (prefix: string, seq: number): string => `${prefix}${String(seq).padStart(12, '0')}`;
const range = (prefix: string): IDBKeyRange => IDBKeyRange.bound(prefix, `${prefix}￿`);

function isRefusal(v: unknown): v is RefusalRecord {
  return typeof v === 'object' && v !== null && typeof (v as RefusalRecord).seq === 'number' && typeof (v as RefusalRecord).code === 'string';
}

function isSetAside(v: unknown): v is SetAsideRecord {
  return typeof v === 'object' && v !== null && typeof (v as SetAsideRecord).seq === 'number' && typeof (v as SetAsideRecord).reason === 'string';
}

/** Reason length in characters (an emoji counts once), matching the shared zod schemas. */
export function reasonLength(text: string): number {
  return Array.from(text.trim()).length;
}

/** The receipt numbers and amount of an outbox item: an order's own, or a cancel's receipts as this PC holds them. */
async function describe(db: SevaDb, item: OutboxItem): Promise<{ receiptNos: string[]; totalPaise: number }> {
  if (item.kind === 'order') {
    return { receiptNos: item.payload.receipts.map((x) => x.receiptNo), totalPaise: item.payload.expectedTotalPaise };
  }
  const local = await Promise.all(item.clientReceiptIds.map((id) => db.get('today', id)));
  const found = local.filter((x) => x !== undefined);
  return { receiptNos: found.map((x) => x.receiptNo), totalPaise: found.reduce((sum, x) => sum + x.totalPaise, 0) };
}

/** Called by the sync when the office refuses an item. Repeating it keeps the first time it was refused. */
export async function recordRefusal(db: SevaDb, seq: number, code: string, at: string): Promise<void> {
  const tx = db.transaction(['meta'], 'readwrite');
  await runTransaction(tx, async () => {
    const meta = tx.objectStore('meta');
    const before = await meta.get(key(REFUSED, seq));
    // A repeat keeps when it was first refused and whether the office was told (it lists the item once).
    const record: RefusalRecord = isRefusal(before) ? { ...before, code } : { seq, code, at };
    await meta.put(record, key(REFUSED, seq));
  });
}

/** The refused items still in the outbox, in issue order. */
export async function refusedItems(db: SevaDb): Promise<RefusedItem[]> {
  const records = (await db.getAll('meta', range(REFUSED))).filter(isRefusal);
  const out: RefusedItem[] = [];
  for (const r of records) {
    const item = await db.get('outbox', r.seq);
    if (!item) continue;
    out.push({ seq: r.seq, kind: item.kind, code: r.code, refusedAt: r.at, ...(await describe(db, item)) });
  }
  return out.sort((a, b) => a.seq - b.seq);
}

/**
 * A temple admin on this PC sets a refused item aside after entering it in the paper book. Throws
 * RangeError('reason_required') for a reason under 3 characters and Error('not_refused') for an item the office has
 * not refused (or that is gone). Nothing changes on a throw.
 */
export async function setAsideRefused(
  db: SevaDb,
  seq: number,
  input: { reason: string; by: { name: string; staffNo: number }; at: string },
): Promise<void> {
  const reason = input.reason.trim();
  if (reasonLength(reason) < SET_ASIDE_REASON_MIN) throw new RangeError('reason_required');
  const tx = db.transaction(['meta', 'outbox'], 'readwrite');
  await runTransaction(tx, async () => {
    const meta = tx.objectStore('meta');
    const outbox = tx.objectStore('outbox');
    const refusal = await meta.get(key(REFUSED, seq));
    const item = await outbox.get(seq);
    if (!isRefusal(refusal) || !item) throw new Error('not_refused');
    const record: SetAsideRecord = { seq, item, code: refusal.code, reason, by: input.by, at: input.at, refusedAt: refusal.at };
    await meta.put(record, key(SET_ASIDE, seq));
    await meta.delete(key(REFUSED, seq));
    await outbox.delete(seq);
  });
  await refreshWaiting(db);
}

/** Every item set aside on this PC, kept with its reason, in issue order. */
export async function setAsideItems(db: SevaDb): Promise<SetAsideRecord[]> {
  return (await db.getAll('meta', range(SET_ASIDE))).filter(isSetAside).sort((a, b) => a.seq - b.seq);
}

/** Marks the records of these outbox numbers reported. */
async function markReported(db: SevaDb, prefix: string, seqs: number[], at: string): Promise<void> {
  const tx = db.transaction(['meta'], 'readwrite');
  await runTransaction(tx, async () => {
    const meta = tx.objectStore('meta');
    for (const seq of seqs) {
      const record: unknown = await meta.get(key(prefix, seq));
      if (isRefusal(record) || isSetAside(record)) await meta.put({ ...record, reportedAt: at }, key(prefix, seq));
    }
  });
}

/**
 * Tells the office about every refusal and set-aside it has not heard of yet: refusals first, then set-asides (only
 * when `setAside` - the signed-in person may set items aside, as the office checks). A call that fails throws and
 * leaves its records unreported for the next run; records it carried are marked reported.
 */
export async function reportRefusals(
  db: SevaDb,
  api: RefusalReporter,
  opts: { setAside: boolean; now?: () => Date },
): Promise<{ refused: number; setAside: number }> {
  const now = opts.now ?? (() => new Date());
  const records = (await db.getAll('meta', range(REFUSED))).filter(isRefusal).filter((r) => !r.reportedAt);
  const refused: RefusalReport[] = [];
  for (const r of records) {
    const item = await db.get('outbox', r.seq);
    if (!item) continue;
    refused.push({ seq: r.seq, kind: item.kind, code: r.code, refusedAt: r.at, ...(await describe(db, item)) });
  }
  if (refused.length > 0) {
    await api.reportRefused(refused);
    await markReported(db, REFUSED, refused.map((r) => r.seq), now().toISOString());
  }

  let setAsideSent = 0;
  if (opts.setAside) {
    const pending = (await setAsideItems(db)).filter((r) => !r.reportedAt);
    if (pending.length > 0) {
      const reports: SetAsideReport[] = [];
      for (const r of pending) {
        reports.push({
          seq: r.seq,
          kind: r.item.kind,
          code: r.code,
          ...(r.refusedAt ? { refusedAt: r.refusedAt } : {}),
          ...(await describe(db, r.item)),
          reason: r.reason,
          setAsideAt: r.at,
        });
      }
      await api.reportSetAside(reports);
      await markReported(db, SET_ASIDE, reports.map((r) => r.seq), now().toISOString());
      setAsideSent = reports.length;
    }
  }
  return { refused: refused.length, setAside: setAsideSent };
}
