/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto';
import type { SevaDb } from '@/lib/seva/offline/db';
import { runSync } from '@/lib/seva/offline/sync';
import { enqueueCancel, enqueueOrder, pendingCount, pendingItems } from '@/lib/seva/offline/outbox';
import { refusedItems, reportRefusals, setAsideItems, setAsideRefused } from '@/lib/seva/offline/refused';
import { connectionStore } from '@/lib/seva/offline/connection';
import type { OutboxItem, SyncResponse } from '@/types/seva';
import { freshDb, offlinePayload, uuid } from './offline-fixtures';

let db: SevaDb;

beforeEach(async () => {
  db = await freshDb();
  connectionStore.setForcedOffline(false);
  connectionStore.markOnline();
  connectionStore.setWaiting(0);
});

const AT = '2026-10-20T06:00:00.000Z';
const ADMIN = { name: 'Srinivas', staffNo: 5 };

async function refuseSecond(): Promise<void> {
  for (const n of [1, 2, 3]) await enqueueOrder(db, offlinePayload(n));
  const sync = jest.fn(async (items: OutboxItem[]): Promise<SyncResponse> => {
    if (items[0].seq === 2) return { results: [{ seq: 2, ok: false, code: 'number_conflict' }] };
    return { results: items.map((i) => ({ seq: i.seq, ok: true })) };
  });
  await runSync({ db, api: { sync } });
}

describe('refused outbox items (M-5)', () => {
  it('a refused order is listed with its code, receipt numbers and amount', async () => {
    await refuseSecond();

    const refused = await refusedItems(db);

    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({
      seq: 2,
      code: 'number_conflict',
      kind: 'order',
      receiptNos: ['OF1-023-10-2026/000002'],
      totalPaise: 10500,
    });
  });

  it('a refused cancel is listed too', async () => {
    await enqueueCancel(db, {
      kind: 'cancel',
      clientReceiptIds: [uuid(801)],
      reasonCode: 'wrong_date',
      at: AT,
      cancelledByStaffNo: 23,
    });
    const sync = jest.fn(async (items: OutboxItem[]): Promise<SyncResponse> => ({
      results: [{ seq: items[0].seq, ok: false, code: 'not_found' }],
    }));
    await runSync({ db, api: { sync } });

    expect(await refusedItems(db)).toEqual([expect.objectContaining({ seq: 1, kind: 'cancel', code: 'not_found' })]);
  });

  it('an admin sets a refused item aside with a reason: it leaves the outbox, so it no longer blocks a day close', async () => {
    await refuseSecond();

    await setAsideRefused(db, 2, { reason: 'Entered in the paper book p.14', by: ADMIN, at: AT });

    expect(await pendingCount(db)).toBe(0);
    expect(await pendingItems(db)).toEqual([]);
    expect(connectionStore.get().waiting).toBe(0);
    expect(await refusedItems(db)).toEqual([]);
    const [kept] = await setAsideItems(db);
    expect(kept).toMatchObject({ seq: 2, code: 'number_conflict', reason: 'Entered in the paper book p.14', by: ADMIN, at: AT });
    expect(kept.item.kind).toBe('order');
  });

  it('refuses to set aside without a 3-character reason, counted in characters, not UTF-16 units', async () => {
    await refuseSecond();

    await expect(setAsideRefused(db, 2, { reason: ' 🙏🙏 ', by: ADMIN, at: AT })).rejects.toThrow('reason_required');
    expect(await pendingCount(db)).toBe(1);
  });

  it('refuses to set aside an item the office has not refused', async () => {
    await enqueueOrder(db, offlinePayload(1));

    await expect(setAsideRefused(db, 1, { reason: 'paper book', by: ADMIN, at: AT })).rejects.toThrow('not_refused');
    expect(await pendingCount(db)).toBe(1);
  });
});

describe('refused outbox items are reported to the office (A5-FIX F5-1)', () => {
  function reporter(fail = false) {
    return {
      reportRefused: jest.fn(async () => {
        if (fail) throw new Error('offline');
        return { results: [] };
      }),
      reportSetAside: jest.fn(async () => {
        if (fail) throw new Error('offline');
        return { results: [] };
      }),
    };
  }

  it('reports each refusal once, with its receipt numbers, amount and code', async () => {
    await refuseSecond();
    const api = reporter();

    await expect(reportRefusals(db, api, { setAside: false })).resolves.toEqual({ refused: 1, setAside: 0 });
    expect(api.reportRefused).toHaveBeenCalledWith([
      expect.objectContaining({
        seq: 2,
        kind: 'order',
        code: 'number_conflict',
        receiptNos: ['OF1-023-10-2026/000002'],
        totalPaise: 10500,
        refusedAt: expect.any(String),
      }),
    ]);

    // Already told: nothing is sent again, even after the sync refuses the item a second time.
    const sync = jest.fn(async (items: OutboxItem[]): Promise<SyncResponse> => ({
      results: [{ seq: items[0].seq, ok: false, code: 'number_conflict' }],
    }));
    await runSync({ db, api: { sync } });
    await expect(reportRefusals(db, api, { setAside: false })).resolves.toEqual({ refused: 0, setAside: 0 });
    expect(api.reportRefused).toHaveBeenCalledTimes(1);
  });

  it('keeps a report the office did not get and sends it on the next run', async () => {
    await refuseSecond();
    await expect(reportRefusals(db, reporter(true), { setAside: false })).rejects.toThrow('offline');
    const api = reporter();
    await expect(reportRefusals(db, api, { setAside: false })).resolves.toEqual({ refused: 1, setAside: 0 });
  });

  it('reports a set-aside with its reason only for someone who may set items aside, once', async () => {
    await refuseSecond();
    await setAsideRefused(db, 2, { reason: 'Entered in the paper book p.14', by: ADMIN, at: AT });
    const api = reporter();

    await expect(reportRefusals(db, api, { setAside: false })).resolves.toEqual({ refused: 0, setAside: 0 });
    expect(api.reportSetAside).not.toHaveBeenCalled();

    await expect(reportRefusals(db, api, { setAside: true })).resolves.toEqual({ refused: 0, setAside: 1 });
    expect(api.reportSetAside).toHaveBeenCalledWith([
      expect.objectContaining({
        seq: 2,
        kind: 'order',
        code: 'number_conflict',
        receiptNos: ['OF1-023-10-2026/000002'],
        totalPaise: 10500,
        reason: 'Entered in the paper book p.14',
        setAsideAt: AT,
      }),
    ]);
    await expect(reportRefusals(db, api, { setAside: true })).resolves.toEqual({ refused: 0, setAside: 0 });
    expect(api.reportSetAside).toHaveBeenCalledTimes(1);
  });
});
