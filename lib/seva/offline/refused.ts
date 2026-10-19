/**
 * Outbox items the office refused (Design Book 8.3, 9.11; review M-5).
 *
 * - The sync records each refusal here (the code and when), next to the item, which stays in the outbox: a printed
 *   slip is never dropped silently.
 * - The counter lists them with their receipt numbers and amount and says what to do next: enter them in the paper
 *   book, then a temple admin sets the item aside on this PC with a reason.
 * - Setting aside moves the item out of the outbox into a kept record (the item, the office's code, the reason, who,
 *   when), in one transaction. The outbox count the heartbeat reports drops, so later day closes are not blocked.
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

/** Called by the sync when the office refuses an item. Repeating it keeps the first time it was refused. */
export async function recordRefusal(db: SevaDb, seq: number, code: string, at: string): Promise<void> {
  const tx = db.transaction(['meta'], 'readwrite');
  await runTransaction(tx, async () => {
    const meta = tx.objectStore('meta');
    const before = await meta.get(key(REFUSED, seq));
    await meta.put({ seq, code, at: isRefusal(before) ? before.at : at } satisfies RefusalRecord, key(REFUSED, seq));
  });
}

/** The refused items still in the outbox, in issue order. */
export async function refusedItems(db: SevaDb): Promise<RefusedItem[]> {
  const records = (await db.getAll('meta', range(REFUSED))).filter(isRefusal);
  const out: RefusedItem[] = [];
  for (const r of records) {
    const item = await db.get('outbox', r.seq);
    if (!item) continue;
    if (item.kind === 'order') {
      out.push({
        seq: r.seq,
        kind: 'order',
        code: r.code,
        refusedAt: r.at,
        receiptNos: item.payload.receipts.map((x) => x.receiptNo),
        totalPaise: item.payload.expectedTotalPaise,
      });
    } else {
      const local = await Promise.all(item.clientReceiptIds.map((id) => db.get('today', id)));
      const found = local.filter((x) => x !== undefined);
      out.push({
        seq: r.seq,
        kind: 'cancel',
        code: r.code,
        refusedAt: r.at,
        receiptNos: found.map((x) => x.receiptNo),
        totalPaise: found.reduce((sum, x) => sum + x.totalPaise, 0),
      });
    }
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
    const record: SetAsideRecord = { seq, item, code: refusal.code, reason, by: input.by, at: input.at };
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
