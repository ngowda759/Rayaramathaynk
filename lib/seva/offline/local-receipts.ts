/**
 * Local copies of issued receipts on the counter PC (Design Book 9.11): today's list, the Excel copy and offline
 * cancels read them. Each copy carries its IST business date and whether the office already has it (`sent`).
 * Older copies are removed after the day is closed, and only when nothing about them is still waiting to send.
 */
import { businessDate } from '@/lib/seva/time';
import type { IssuedReceipt, OutboxItem } from '@/types/seva';
import { runTransaction, type LocalReceipt, type SevaDb, type SevaStoreName, type WritableStore } from './db';

const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function assertDate(date: string): void {
  if (!DATE_PATTERN.test(date)) throw new RangeError('invalid_date');
}

function toLocal(r: IssuedReceipt, sent: boolean): LocalReceipt {
  const issuedAt = new Date(r.issuedAt);
  if (Number.isNaN(issuedAt.getTime())) throw new RangeError('invalid_issued_at');
  return { ...r, businessDate: businessDate(issuedAt), sent };
}

/** The receipt without this PC's own bookkeeping fields. */
function toIssued(local: LocalReceipt): IssuedReceipt {
  const receipt: IssuedReceipt & Partial<Pick<LocalReceipt, 'businessDate' | 'sent'>> = { ...local };
  delete receipt.businessDate;
  delete receipt.sent;
  return receipt;
}

/** Inside a caller's transaction: keeps one receipt's local copy. */
export async function putLocalReceipt<T extends ArrayLike<SevaStoreName>>(
  store: WritableStore<'today', T>,
  receipt: IssuedReceipt,
  sent: boolean,
): Promise<void> {
  await store.put(toLocal(receipt, sent));
}

/** Inside a caller's transaction: rewrites the local copies of these receipts that this PC has. */
export async function updateLocalReceipts<T extends ArrayLike<SevaStoreName>>(
  store: WritableStore<'today', T>,
  clientReceiptIds: readonly string[],
  change: (r: LocalReceipt) => LocalReceipt,
): Promise<void> {
  for (const id of clientReceiptIds) {
    const local = await store.get(id);
    if (local) await store.put(change(local));
  }
}

/** Every receipt an outbox item still has to tell the office about. */
export function receiptIdsWaiting(items: readonly OutboxItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.kind === 'order') {
      for (const r of item.payload.receipts) ids.add(r.clientReceiptId);
    } else {
      for (const id of item.clientReceiptIds) ids.add(id);
    }
  }
  return ids;
}

/** Keeps local copies of these receipts; `sent` is true when the office already has them. */
export async function rememberReceipts(db: SevaDb, receipts: IssuedReceipt[], sent: boolean): Promise<void> {
  if (receipts.length === 0) return;
  const tx = db.transaction('today', 'readwrite');
  await runTransaction(tx, async () => {
    for (const r of receipts) await putLocalReceipt(tx.store, r, sent);
  });
}

/** The local receipts of one IST business date ('YYYY-MM-DD'), oldest first. */
export async function todaysReceipts(db: SevaDb, date: string): Promise<IssuedReceipt[]> {
  assertDate(date);
  const locals = await db.getAllFromIndex('today', 'byDate', date);
  locals.sort(
    (a, b) =>
      Date.parse(a.issuedAt) - Date.parse(b.issuedAt) ||
      (a.groupNo < b.groupNo ? -1 : a.groupNo > b.groupNo ? 1 : 0) ||
      a.position - b.position,
  );
  return locals.map(toIssued);
}

/**
 * Removes local receipts of business dates before `beforeDate` that the office already has. Receipts not yet sent,
 * or named by an outbox item that is still waiting (an offline cancel), are kept.
 */
export async function pruneClosedDays(db: SevaDb, beforeDate: string): Promise<void> {
  assertDate(beforeDate);
  const tx = db.transaction(['today', 'outbox'], 'readwrite');
  await runTransaction(tx, async () => {
    const waiting = receiptIdsWaiting(await tx.objectStore('outbox').getAll());
    let cursor = await tx.objectStore('today').index('byDate').openCursor(IDBKeyRange.upperBound(beforeDate, true));
    while (cursor) {
      if (cursor.value.sent && !waiting.has(cursor.value.clientReceiptId)) await cursor.delete();
      cursor = await cursor.continue();
    }
  });
}
