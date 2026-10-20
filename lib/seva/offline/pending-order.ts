/**
 * The client ids of the order on the counter screen (Design Book 8.6, C-53; review H-3).
 *
 * - The same order keeps its client order id, client receipt ids and QR tokens across retries, so the office returns
 *   the stored order if an earlier attempt got through.
 * - A changed order normally gets new ids.
 * - An order is "in doubt" once the office did not answer three attempts and the receptionist chose not to print
 *   offline: the office may already hold it. From then on, even an edited order keeps its client order id. Its next
 *   online save therefore checks with the office first: the office returns the first order if it has it, and stores
 *   the edited one under that id only if it does not. An offline save names it in `supersedesClientOrderId`.
 * - The in-doubt order is kept in this PC's IndexedDB (`meta`, key `pending-order`) until the office answers for it,
 *   so a reload or leaving the counter page keeps it and the next save still asks the office about the first one
 *   (FINAL-FIX N-3). Only the same business date's in-doubt order comes back; an earlier day's is let go, and the
 *   office's `unprinted_online` card (last 7 days) shows its receipts if it was stored.
 */
import type { SevaDb } from './db';

export interface OrderIds {
  clientOrderId: string;
  clientReceiptIds: string[];
  qrTokens: string[];
}

export interface PendingOrder {
  /** The order as it would be sent, without its ids. */
  key: string;
  ids: OrderIds;
  /** The office may hold this client order id already. */
  inDoubt: boolean;
  /** The order as it was when it went in doubt; set only while in doubt. */
  inDoubtKey?: string;
}

export interface IdMaker {
  id(): string;
  qrToken(): string;
}

function fill(kept: readonly string[], count: number, make: () => string): string[] {
  return Array.from({ length: count }, (_, i) => kept[i] ?? make());
}

/** The ids to send for the order `key` with `receiptCount` receipts, given what is pending on the screen. */
export function orderIdsFor(pending: PendingOrder | null, key: string, receiptCount: number, make: IdMaker): PendingOrder {
  if (pending && pending.key === key && pending.ids.clientReceiptIds.length === receiptCount) return pending;
  if (pending?.inDoubt) {
    return {
      key,
      inDoubt: true,
      inDoubtKey: pending.inDoubtKey ?? pending.key,
      ids: {
        clientOrderId: pending.ids.clientOrderId,
        clientReceiptIds: fill(pending.ids.clientReceiptIds, receiptCount, make.id),
        qrTokens: fill(pending.ids.qrTokens, receiptCount, make.qrToken),
      },
    };
  }
  return {
    key,
    inDoubt: false,
    ids: {
      clientOrderId: make.id(),
      clientReceiptIds: fill([], receiptCount, make.id),
      qrTokens: fill([], receiptCount, make.qrToken),
    },
  };
}

/** The office did not answer and nothing was printed: keep the ids, and remember the order as it was then. */
export function markInDoubt(pending: PendingOrder, key: string): PendingOrder {
  return { ...pending, inDoubt: true, inDoubtKey: pending.inDoubtKey ?? key };
}

/** True when the order on the screen was edited after it went in doubt. */
export function editedSinceInDoubt(pending: PendingOrder | null): boolean {
  return pending !== null && pending.inDoubt && pending.inDoubtKey !== undefined && pending.inDoubtKey !== pending.key;
}

/** The `meta` key of the in-doubt order. */
export const PENDING_ORDER_KEY = 'pending-order';

interface StoredPendingOrder {
  pending: PendingOrder;
  /** The IST business date the order went in doubt. */
  businessDate: string;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string' && v.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The stored record, or null when it is not a well-formed in-doubt order. */
function readStored(value: unknown): StoredPendingOrder | null {
  if (!isRecord(value) || typeof value.businessDate !== 'string' || !isRecord(value.pending)) return null;
  const { key, ids, inDoubt, inDoubtKey } = value.pending;
  if (typeof key !== 'string' || inDoubt !== true || !isRecord(ids)) return null;
  if (inDoubtKey !== undefined && typeof inDoubtKey !== 'string') return null;
  const { clientOrderId, clientReceiptIds, qrTokens } = ids;
  if (typeof clientOrderId !== 'string' || clientOrderId.length === 0) return null;
  if (!isStringArray(clientReceiptIds) || !isStringArray(qrTokens) || clientReceiptIds.length !== qrTokens.length) return null;
  return {
    businessDate: value.businessDate,
    pending: {
      key,
      inDoubt: true,
      ...(inDoubtKey !== undefined ? { inDoubtKey } : {}),
      ids: { clientOrderId, clientReceiptIds, qrTokens },
    },
  };
}

/** Keeps an in-doubt order on this PC (an order not in doubt is never stored: the office answered for it). */
export async function savePendingOrder(db: SevaDb, pending: PendingOrder, businessDate: string): Promise<void> {
  if (!pending.inDoubt) {
    await db.delete('meta', PENDING_ORDER_KEY);
    return;
  }
  const record: StoredPendingOrder = { pending, businessDate };
  await db.put('meta', record, PENDING_ORDER_KEY);
}

/** The office answered for the in-doubt order, or it was let go. */
export async function clearPendingOrder(db: SevaDb): Promise<void> {
  await db.delete('meta', PENDING_ORDER_KEY);
}

/**
 * The in-doubt order kept on this PC, for the counter page as it opens. `expired` is true when one was kept from an
 * earlier business date: it is let go (deleted), as an order cleared from the screen is. A damaged record is deleted.
 */
export async function loadPendingOrder(
  db: SevaDb,
  today: string,
): Promise<{ pending: PendingOrder | null; expired: boolean }> {
  const raw = await db.get('meta', PENDING_ORDER_KEY);
  if (raw === undefined) return { pending: null, expired: false };
  const stored = readStored(raw);
  if (stored && stored.businessDate === today) return { pending: stored.pending, expired: false };
  await db.delete('meta', PENDING_ORDER_KEY);
  return { pending: null, expired: stored !== null };
}
