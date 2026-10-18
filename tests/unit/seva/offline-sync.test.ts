/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto';
import type { SevaDb } from '@/lib/seva/offline/db';
import { runSync } from '@/lib/seva/offline/sync';
import { startHeartbeat } from '@/lib/seva/offline/heartbeat';
import { enqueueCancel, enqueueOrder, pendingItems } from '@/lib/seva/offline/outbox';
import { takeOfflineNumbers } from '@/lib/seva/offline/allocator';
import { rememberReceipts } from '@/lib/seva/offline/local-receipts';
import { connectionStore } from '@/lib/seva/offline/connection';
import type { OutboxItem, SyncResponse } from '@/types/seva';
import { FakeClientError, freshDb, issuedReceipt, NOW, offlinePayload, uuid } from './offline-fixtures';

let db: SevaDb;

beforeEach(async () => {
  db = await freshDb();
  connectionStore.setForcedOffline(false);
  connectionStore.markOnline();
  connectionStore.setWaiting(0);
});

function okFor(items: OutboxItem[], extra: Partial<SyncResponse['results'][number]> = {}): SyncResponse {
  return { results: items.map((i) => ({ seq: i.seq, ok: true, ...extra })) };
}

async function queueThreeOrders(): Promise<void> {
  for (const n of [1, 2, 3]) await enqueueOrder(db, offlinePayload(n));
}

describe('outbox sync', () => {
  it('sends the outbox in order and stops at a network error', async () => {
    await queueThreeOrders();
    const sync = jest.fn(async (items: OutboxItem[]) => {
      if (items[0].seq === 2) throw new FakeClientError('network', 0);
      return okFor(items);
    });

    await expect(runSync({ db, api: { sync } })).resolves.toEqual({ sent: 1, refused: [], stoppedBy: 'network' });
    expect(sync.mock.calls.map(([items]) => items.map((i) => i.seq))).toEqual([[1], [2]]);
    expect((await pendingItems(db)).map((i) => i.seq)).toEqual([2, 3]);
    expect(connectionStore.get().waiting).toBe(2);

    const later = jest.fn(async (items: OutboxItem[]) => okFor(items));
    await expect(runSync({ db, api: { sync: later } })).resolves.toEqual({ sent: 2, refused: [], stoppedBy: null });
    expect(later.mock.calls.map(([items]) => items.map((i) => i.seq))).toEqual([[2], [3]]);
    expect(await pendingItems(db)).toEqual([]);
    expect(connectionStore.get().waiting).toBe(0);
  });

  it('stops on a server error and on rate limiting without losing anything', async () => {
    await queueThreeOrders();
    const busy = jest.fn(async () => {
      throw new FakeClientError('internal', 503);
    });
    await expect(runSync({ db, api: { sync: busy } })).resolves.toEqual({ sent: 0, refused: [], stoppedBy: 'network' });
    const limited = jest.fn(async () => {
      throw new FakeClientError('rate_limited', 429);
    });
    await expect(runSync({ db, api: { sync: limited } })).resolves.toEqual({ sent: 0, refused: [], stoppedBy: 'network' });
    expect((await pendingItems(db)).map((i) => i.seq)).toEqual([1, 2, 3]);
  });

  it('treats a duplicate answer as sent', async () => {
    await enqueueOrder(db, offlinePayload(1));
    const sync = jest.fn(async (items: OutboxItem[]) => okFor(items, { duplicate: true }));

    await expect(runSync({ db, api: { sync } })).resolves.toEqual({ sent: 1, refused: [], stoppedBy: null });
    expect(await pendingItems(db)).toEqual([]);
  });

  it('flags the local receipts of a sent order as sent', async () => {
    const payload = offlinePayload(1);
    await rememberReceipts(
      db,
      [issuedReceipt({ clientReceiptId: payload.receipts[0].clientReceiptId, receiptNo: payload.receipts[0].receiptNo, issuedAt: NOW.toISOString(), issuedOffline: true })],
      false,
    );
    await enqueueOrder(db, payload);

    await runSync({ db, api: { sync: async (items) => okFor(items) } });

    expect((await db.get('today', payload.receipts[0].clientReceiptId))?.sent).toBe(true);
  });

  it('keeps a refused item in the outbox, reports it and carries on', async () => {
    await queueThreeOrders();
    const sync = jest.fn(async (items: OutboxItem[]): Promise<SyncResponse> => {
      if (items[0].seq === 1) return { results: [{ seq: 1, ok: false, code: 'number_conflict' }] };
      return okFor(items);
    });

    await expect(runSync({ db, api: { sync } })).resolves.toEqual({
      sent: 2,
      refused: [{ seq: 1, code: 'number_conflict' }],
      stoppedBy: null,
    });
    expect((await pendingItems(db)).map((i) => i.seq)).toEqual([1]);
    expect(connectionStore.get().waiting).toBe(1);
  });

  it('refuses only that item when the office rejects it as invalid', async () => {
    await queueThreeOrders();
    const sync = jest.fn(async (items: OutboxItem[]) => {
      if (items[0].seq === 2) throw new FakeClientError('validation', 400);
      return okFor(items);
    });

    await expect(runSync({ db, api: { sync } })).resolves.toEqual({
      sent: 2,
      refused: [{ seq: 2, code: 'validation' }],
      stoppedBy: null,
    });
    expect((await pendingItems(db)).map((i) => i.seq)).toEqual([2]);
  });

  it('counts an already cancelled receipt as a sent cancel', async () => {
    await enqueueCancel(db, { kind: 'cancel', clientReceiptIds: [uuid(801)], reasonCode: 'wrong_seva', at: NOW.toISOString() });
    const sync = jest.fn(async (): Promise<SyncResponse> => ({ results: [{ seq: 1, ok: false, code: 'already_cancelled' }] }));

    await expect(runSync({ db, api: { sync } })).resolves.toEqual({ sent: 1, refused: [], stoppedBy: null });
    expect(await pendingItems(db)).toEqual([]);
  });

  it('stops and passes on an error about the sign-in or the device', async () => {
    await queueThreeOrders();
    const sync = jest.fn(async () => {
      throw new FakeClientError('device_unknown', 403);
    });

    await expect(runSync({ db, api: { sync } })).rejects.toMatchObject({ code: 'device_unknown', status: 403 });
    expect(sync).toHaveBeenCalledTimes(1);
    expect((await pendingItems(db)).map((i) => i.seq)).toEqual([1, 2, 3]);
  });

  it('stops when the answer does not cover the item it sent', async () => {
    await queueThreeOrders();
    const sync = jest.fn(async (): Promise<SyncResponse> => ({ results: [] }));

    await expect(runSync({ db, api: { sync } })).resolves.toEqual({ sent: 0, refused: [], stoppedBy: 'network' });
    expect((await pendingItems(db)).map((i) => i.seq)).toEqual([1, 2, 3]);
  });

  it('does nothing when nothing is waiting', async () => {
    const sync = jest.fn(async (items: OutboxItem[]) => okFor(items));
    await expect(runSync({ db, api: { sync } })).resolves.toEqual({ sent: 0, refused: [], stoppedBy: null });
    expect(sync).not.toHaveBeenCalled();
  });

  it('runs one sync at a time in a tab', async () => {
    await queueThreeOrders();
    const sync = jest.fn(async (items: OutboxItem[]) => okFor(items));

    const [a, b] = await Promise.all([runSync({ db, api: { sync } }), runSync({ db, api: { sync } })]);

    expect(a).toEqual({ sent: 3, refused: [], stoppedBy: null });
    expect(b).toEqual(a);
    expect(sync).toHaveBeenCalledTimes(3);
  });
});

describe('heartbeat', () => {
  it('heartbeat raises the offline floor and reports clock skew', async () => {
    await enqueueOrder(db, offlinePayload(1));
    // The PC clock is 3 minutes ahead of the office.
    const heartbeat = jest.fn(async () => ({
      serverTime: new Date(NOW.getTime() - 180_000).toISOString(),
      ofSeries: 'OF1',
      lastOfNo: 41,
      dayClosed: false,
    }));
    const results: { skewMs: number; dayClosed: boolean }[] = [];
    let second: () => void = () => undefined;
    const twoBeats = new Promise<void>((resolve) => (second = resolve));

    const stop = startHeartbeat({
      api: { heartbeat },
      db,
      clock: () => NOW,
      intervalMs: 20,
      onResult: (r) => {
        results.push(r);
        if (results.length === 2) second();
      },
    });
    await twoBeats;
    stop();

    expect(results[0]).toEqual({ skewMs: 180_000, dayClosed: false });
    expect(heartbeat.mock.calls[0]).toEqual([{ outboxCount: 1, clockSkewMs: 0, appVersion: expect.any(String) }]);
    expect(heartbeat.mock.calls[1]).toEqual([{ outboxCount: 1, clockSkewMs: 180_000, appVersion: expect.any(String) }]);
    expect(await takeOfflineNumbers(db, { series: 'OF1', year: 2026, count: 1 })).toBe(42);
    expect(connectionStore.get()).toMatchObject({ status: 'online', waiting: 1 });
  });

  it('marks the counter offline when the heartbeat cannot reach the office, and stops cleanly', async () => {
    const heartbeat = jest.fn(async () => {
      throw new FakeClientError('network', 0);
    });
    const onResult = jest.fn();
    let failed: () => void = () => undefined;
    const done = new Promise<void>((resolve) => (failed = resolve));
    heartbeat.mockImplementationOnce(async () => {
      failed();
      throw new FakeClientError('network', 0);
    });

    const stop = startHeartbeat({ api: { heartbeat }, db, clock: () => NOW, intervalMs: 60_000, onResult });
    await done;
    await new Promise((resolve) => setTimeout(resolve, 10));
    stop();

    expect(onResult).not.toHaveBeenCalled();
    expect(connectionStore.get()).toMatchObject({ status: 'offline', since: NOW.toISOString() });
    expect(heartbeat).toHaveBeenCalledTimes(1);
  });
});
