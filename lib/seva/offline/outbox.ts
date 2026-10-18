/**
 * The counter outbox (Design Book 9.11): orders and cancels made offline, in issue order, until the office accepts
 * them. Each item gets a `seq` from a counter in `meta` that only goes up, in the same transaction that stores it.
 * The waiting count in the connection store follows every change made here.
 */
import type { OfflineOrderPayload, OutboxItem } from '@/types/seva';
import { takeFromCounter } from './allocator';
import { connectionStore } from './connection';
import { runTransaction, type SevaDb, type SevaStoreName, type WritableStore } from './db';
import { updateLocalReceipts } from './local-receipts';

const SEQ_KEY = 'outbox:seq';

type CancelItem = Extract<OutboxItem, { kind: 'cancel' }>;
type OutboxDraft = { kind: 'order'; payload: OfflineOrderPayload } | Omit<CancelItem, 'seq'>;

/** Inside a caller's transaction: stores an outbox item under the next `seq` and returns it. */
export async function putOutboxItem<T extends ArrayLike<SevaStoreName>>(
  meta: WritableStore<'meta', T>,
  outbox: WritableStore<'outbox', T>,
  draft: OutboxDraft,
): Promise<number> {
  const seq = await takeFromCounter(meta, SEQ_KEY, 1);
  const item: OutboxItem =
    draft.kind === 'order'
      ? { seq, kind: 'order', payload: draft.payload }
      : {
          seq,
          kind: 'cancel',
          clientReceiptIds: [...draft.clientReceiptIds],
          reasonCode: draft.reasonCode,
          ...(draft.note !== undefined ? { note: draft.note } : {}),
          at: draft.at,
        };
  await outbox.put(item);
  return seq;
}

/** Puts the current outbox size into the connection store. */
export async function refreshWaiting(db: SevaDb): Promise<void> {
  connectionStore.setWaiting(await pendingCount(db));
}

export async function enqueueOrder(db: SevaDb, payload: OfflineOrderPayload): Promise<number> {
  if (payload.receipts.length === 0) throw new RangeError('empty_order');
  const tx = db.transaction(['meta', 'outbox'], 'readwrite');
  const seq = await runTransaction(tx, () =>
    putOutboxItem(tx.objectStore('meta'), tx.objectStore('outbox'), { kind: 'order', payload }),
  );
  await refreshWaiting(db);
  return seq;
}

/** Queues an offline cancel and marks this PC's copies of those receipts cancelled in the same transaction. */
export async function enqueueCancel(db: SevaDb, c: Omit<CancelItem, 'seq'>): Promise<number> {
  if (c.clientReceiptIds.length === 0) throw new RangeError('empty_cancel');
  if (Number.isNaN(Date.parse(c.at))) throw new RangeError('invalid_cancel_time');
  const tx = db.transaction(['meta', 'outbox', 'today'], 'readwrite');
  const seq = await runTransaction(tx, async () => {
    const queued = await putOutboxItem(tx.objectStore('meta'), tx.objectStore('outbox'), c);
    await updateLocalReceipts(tx.objectStore('today'), c.clientReceiptIds, (r) => ({ ...r, status: 'cancelled' }));
    return queued;
  });
  await refreshWaiting(db);
  return seq;
}

/** Everything still waiting, in issue order. */
export async function pendingItems(db: SevaDb): Promise<OutboxItem[]> {
  return db.getAll('outbox');
}

/** The office has the item: removes it and, for an order, flags its local receipts as sent. Repeating is harmless. */
export async function markSent(db: SevaDb, seq: number): Promise<void> {
  const tx = db.transaction(['outbox', 'today'], 'readwrite');
  await runTransaction(tx, async () => {
    const outbox = tx.objectStore('outbox');
    const item = await outbox.get(seq);
    if (!item) return;
    if (item.kind === 'order') {
      const ids = item.payload.receipts.map((r) => r.clientReceiptId);
      await updateLocalReceipts(tx.objectStore('today'), ids, (r) => ({ ...r, sent: true }));
    }
    await outbox.delete(seq);
  });
  await refreshWaiting(db);
}

export async function pendingCount(db: SevaDb): Promise<number> {
  return db.count('outbox');
}
