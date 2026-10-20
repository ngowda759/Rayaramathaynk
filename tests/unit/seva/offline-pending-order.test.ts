/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto';
import { openSevaDb, type SevaDb } from '@/lib/seva/offline/db';
import {
  clearPendingOrder,
  loadPendingOrder,
  markInDoubt,
  orderIdsFor,
  PENDING_ORDER_KEY,
  savePendingOrder,
  type PendingOrder,
} from '@/lib/seva/offline/pending-order';
import { freshDb } from './offline-fixtures';

function maker() {
  let n = 0;
  return {
    id: () => `id-${++n}`,
    qrToken: () => `qr-${++n}`,
  };
}

describe('pending order ids (H-3)', () => {
  it('the same order keeps its ids; a changed order gets new ones', () => {
    const make = maker();
    const first = orderIdsFor(null, 'A', 2, make);
    expect(orderIdsFor(first, 'A', 2, make)).toBe(first);

    const changed = orderIdsFor(first, 'B', 2, make);
    expect(changed.ids.clientOrderId).not.toBe(first.ids.clientOrderId);
    expect(changed.inDoubt).toBe(false);
  });

  it('after an in-doubt "No", an edited order keeps its client order id, so the office is asked about the first one', () => {
    const make = maker();
    const first = markInDoubt(orderIdsFor(null, 'A', 2, make), 'A');

    const edited = orderIdsFor(first, 'B', 3, make);

    expect(edited.inDoubt).toBe(true);
    expect(edited.inDoubtKey).toBe('A');
    expect(edited.key).toBe('B');
    expect(edited.ids.clientOrderId).toBe(first.ids.clientOrderId);
    expect(edited.ids.clientReceiptIds.slice(0, 2)).toEqual(first.ids.clientReceiptIds);
    expect(edited.ids.clientReceiptIds).toHaveLength(3);
    expect(edited.ids.qrTokens).toHaveLength(3);
    expect(new Set(edited.ids.clientReceiptIds).size).toBe(3);

    const fewer = orderIdsFor(edited, 'C', 1, make);
    expect(fewer.ids.clientOrderId).toBe(first.ids.clientOrderId);
    expect(fewer.ids.clientReceiptIds).toEqual([first.ids.clientReceiptIds[0]]);
  });

  it('an in-doubt order is edited only when its key changed', () => {
    const make = maker();
    const pending: PendingOrder = markInDoubt(orderIdsFor(null, 'A', 1, make), 'A');
    expect(pending.inDoubtKey).toBe('A');
    expect(orderIdsFor(pending, 'A', 1, make)).toBe(pending);
  });
});

describe('the in-doubt order survives a reload (FINAL-FIX N-3)', () => {
  let db: SevaDb;

  beforeEach(async () => {
    db = await freshDb();
  });

  afterEach(() => {
    db.close();
  });

  /** A reload: this connection closes and the counter page opens the database again. */
  async function reopen(): Promise<SevaDb> {
    db.close();
    db = await openSevaDb();
    return db;
  }

  it('in doubt, then a reload, then the same order saved again: it sends the first client order id', async () => {
    const make = maker();
    const first = markInDoubt(orderIdsFor(null, 'A', 2, make), 'A');
    await savePendingOrder(db, first, '2026-10-20');

    const restored = await loadPendingOrder(await reopen(), '2026-10-20');
    expect(restored).toEqual({ pending: first, expired: false });

    const again = orderIdsFor(restored.pending, 'A', 2, make);
    expect(again.ids).toEqual(first.ids);
    // Re-entered with a change after the reload: still asked about the first order.
    const edited = orderIdsFor(restored.pending, 'B', 1, make);
    expect(edited.inDoubt).toBe(true);
    expect(edited.ids.clientOrderId).toBe(first.ids.clientOrderId);
  });

  it('is kept until the office answers: cleared, a reload finds nothing', async () => {
    const make = maker();
    await savePendingOrder(db, markInDoubt(orderIdsFor(null, 'A', 1, make), 'A'), '2026-10-20');
    await clearPendingOrder(db);
    expect(await loadPendingOrder(await reopen(), '2026-10-20')).toEqual({ pending: null, expired: false });
  });

  it("an in-doubt order of an earlier day is let go (the office's unprinted_online card shows it)", async () => {
    const make = maker();
    await savePendingOrder(db, markInDoubt(orderIdsFor(null, 'A', 1, make), 'A'), '2026-10-19');
    expect(await loadPendingOrder(await reopen(), '2026-10-20')).toEqual({ pending: null, expired: true });
    expect(await db.get('meta', PENDING_ORDER_KEY)).toBeUndefined();
  });

  it('never restores an order that is not in doubt, or a damaged record', async () => {
    const make = maker();
    await savePendingOrder(db, orderIdsFor(null, 'A', 1, make), '2026-10-20');
    expect(await db.get('meta', PENDING_ORDER_KEY)).toBeUndefined();

    for (const bad of [null, 'x', { businessDate: '2026-10-20' }, { businessDate: '2026-10-20', pending: { key: 'A', inDoubt: true, ids: { clientOrderId: 1 } } }]) {
      await db.put('meta', bad, PENDING_ORDER_KEY);
      expect(await loadPendingOrder(db, '2026-10-20')).toEqual({ pending: null, expired: false });
      expect(await db.get('meta', PENDING_ORDER_KEY)).toBeUndefined();
    }
  });
});
