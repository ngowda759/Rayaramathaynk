/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto';
import type { SevaDb } from '@/lib/seva/offline/db';
import { enqueueCancel, enqueueOrder, markSent, pendingCount, pendingItems } from '@/lib/seva/offline/outbox';
import { pruneClosedDays, rememberReceipts, todaysReceipts } from '@/lib/seva/offline/local-receipts';
import { connectionStore, createConnectionStore } from '@/lib/seva/offline/connection';
import { freshDb, issuedReceipt, NOW, offlinePayload, uuid } from './offline-fixtures';

let db: SevaDb;

beforeEach(async () => {
  db = await freshDb();
  connectionStore.setWaiting(0);
});

describe('outbox', () => {
  it('queues orders and cancels in issue order with numbers that only go up', async () => {
    expect(await enqueueOrder(db, offlinePayload(1))).toBe(1);
    expect(await enqueueCancel(db, { kind: 'cancel', clientReceiptIds: [uuid(801)], reasonCode: 'other', note: 'Typed twice', at: NOW.toISOString() })).toBe(2);
    expect(await pendingCount(db)).toBe(2);
    expect(connectionStore.get().waiting).toBe(2);

    const items = await pendingItems(db);
    expect(items.map((i) => [i.seq, i.kind])).toEqual([
      [1, 'order'],
      [2, 'cancel'],
    ]);
    expect(items[1]).toEqual({
      seq: 2,
      kind: 'cancel',
      clientReceiptIds: [uuid(801)],
      reasonCode: 'other',
      note: 'Typed twice',
      at: NOW.toISOString(),
    });

    await markSent(db, 2);
    await markSent(db, 2);
    expect((await pendingItems(db)).map((i) => i.seq)).toEqual([1]);
    expect(await enqueueOrder(db, offlinePayload(3))).toBe(3);
    expect(connectionStore.get().waiting).toBe(2);
  });

  it('refuses an empty order or cancel', async () => {
    await expect(enqueueOrder(db, { ...offlinePayload(1), receipts: [] })).rejects.toThrow(RangeError);
    await expect(enqueueCancel(db, { kind: 'cancel', clientReceiptIds: [], reasonCode: 'other', at: NOW.toISOString() })).rejects.toThrow(RangeError);
    expect(await pendingCount(db)).toBe(0);
  });

  it('an offline cancel marks the local copy cancelled', async () => {
    const receipt = issuedReceipt({ clientReceiptId: uuid(801), receiptNo: 'C1-023-10-2026/000124', issuedAt: NOW.toISOString() });
    await rememberReceipts(db, [receipt], true);

    await enqueueCancel(db, { kind: 'cancel', clientReceiptIds: [uuid(801), uuid(999)], reasonCode: 'wrong_seva', at: NOW.toISOString() });

    const [local] = await todaysReceipts(db, '2026-10-18');
    expect(local.status).toBe('cancelled');
  });
});

describe('local receipts', () => {
  it('lists the receipts of one IST business date without the local flags', async () => {
    await rememberReceipts(
      db,
      [
        issuedReceipt({ clientReceiptId: uuid(1), receiptNo: 'C1-023-10-2026/000001', issuedAt: '2026-10-17T18:29:59.000Z' }),
        issuedReceipt({ clientReceiptId: uuid(3), receiptNo: 'C1-023-10-2026/000003', issuedAt: '2026-10-18T09:00:00.000Z' }),
        issuedReceipt({ clientReceiptId: uuid(2), receiptNo: 'C1-023-10-2026/000002', issuedAt: '2026-10-17T18:30:00.000Z' }),
      ],
      true,
    );

    expect((await todaysReceipts(db, '2026-10-17')).map((r) => r.receiptNo)).toEqual(['C1-023-10-2026/000001']);
    const today = await todaysReceipts(db, '2026-10-18');
    expect(today.map((r) => r.receiptNo)).toEqual(['C1-023-10-2026/000002', 'C1-023-10-2026/000003']);
    expect(today[0]).not.toHaveProperty('sent');
    expect(today[0]).not.toHaveProperty('businessDate');
  });

  it('keeps unsent receipts when pruning a closed day', async () => {
    const sentOld = issuedReceipt({ clientReceiptId: uuid(1), receiptNo: 'C1-023-10-2026/000001', issuedAt: '2026-10-16T06:00:00.000Z' });
    const unsentOld = issuedReceipt({ clientReceiptId: uuid(2), receiptNo: 'OF1-023-10-2026/000001', issuedAt: '2026-10-16T07:00:00.000Z', issuedOffline: true });
    const cancelWaiting = issuedReceipt({ clientReceiptId: uuid(3), receiptNo: 'C1-023-10-2026/000002', issuedAt: '2026-10-16T08:00:00.000Z' });
    const sentToday = issuedReceipt({ clientReceiptId: uuid(4), receiptNo: 'C1-023-10-2026/000003', issuedAt: NOW.toISOString() });
    await rememberReceipts(db, [sentOld, cancelWaiting, sentToday], true);
    await rememberReceipts(db, [unsentOld], false);
    await enqueueCancel(db, { kind: 'cancel', clientReceiptIds: [uuid(3)], reasonCode: 'changed_mind', at: '2026-10-16T08:10:00.000Z' });

    await pruneClosedDays(db, '2026-10-18');

    expect((await todaysReceipts(db, '2026-10-16')).map((r) => r.clientReceiptId)).toEqual([uuid(2), uuid(3)]);
    expect((await todaysReceipts(db, '2026-10-18')).map((r) => r.clientReceiptId)).toEqual([uuid(4)]);
    await expect(pruneClosedDays(db, '18-10-2026')).rejects.toThrow(RangeError);
  });

  it('markSent flags the local receipts of the order as sent', async () => {
    const payload = offlinePayload(1);
    const receipt = issuedReceipt({
      clientReceiptId: payload.receipts[0].clientReceiptId,
      receiptNo: payload.receipts[0].receiptNo,
      issuedAt: '2026-10-16T07:00:00.000Z',
      issuedOffline: true,
    });
    await rememberReceipts(db, [receipt], false);
    const seq = await enqueueOrder(db, payload);

    await pruneClosedDays(db, '2026-10-18');
    expect(await todaysReceipts(db, '2026-10-16')).toHaveLength(1);

    await markSent(db, seq);
    expect((await db.get('today', receipt.clientReceiptId))?.sent).toBe(true);
    await pruneClosedDays(db, '2026-10-18');
    expect(await todaysReceipts(db, '2026-10-16')).toEqual([]);
  });
});

describe('connection store', () => {
  it('tracks offline since, waiting and the Work offline switch', () => {
    const store = createConnectionStore();
    const seen: string[] = [];
    const unsubscribe = store.subscribe((s) => seen.push(`${s.status}:${s.forced}:${s.waiting}`));
    expect(store.get()).toEqual({ status: 'online', since: null, waiting: 0, forced: false });

    store.markOffline(new Date('2026-10-18T04:42:00.000Z'));
    store.markOffline(new Date('2026-10-18T04:50:00.000Z'));
    expect(store.get()).toMatchObject({ status: 'offline', since: '2026-10-18T04:42:00.000Z' });

    store.setWaiting(3);
    store.markOnline();
    expect(store.get()).toEqual({ status: 'online', since: null, waiting: 3, forced: false });

    store.setForcedOffline(true);
    expect(store.get()).toMatchObject({ status: 'offline', forced: true });
    expect(store.get().since).not.toBeNull();
    store.markOnline();
    expect(store.get()).toMatchObject({ status: 'offline', forced: true });

    store.setForcedOffline(false);
    store.markOnline();
    expect(store.get()).toMatchObject({ status: 'online', forced: false, since: null });

    unsubscribe();
    store.setWaiting(0);
    expect(seen[seen.length - 1]).toBe('online:false:3');
    expect(seen.length).toBeGreaterThanOrEqual(6);
  });
});
