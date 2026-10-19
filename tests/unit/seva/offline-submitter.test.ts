/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto';
import type { SevaDb } from '@/lib/seva/offline/db';
import { createCounterSubmitter } from '@/lib/seva/offline/submitter';
import { pendingCount, pendingItems } from '@/lib/seva/offline/outbox';
import { takeOfflineNumbers } from '@/lib/seva/offline/allocator';
import { todaysReceipts } from '@/lib/seva/offline/local-receipts';
import { connectionStore } from '@/lib/seva/offline/connection';
import { isQrToken } from '@/lib/seva/qr';
import type { CounterBootstrap, CounterOrderPayload, IssueResponse } from '@/types/seva';
import {
  bookOrder,
  bootstrap,
  COUNTER,
  FakeClientError,
  freshDb,
  idSequence,
  KARNIKE,
  NOW,
  onlineAnswer,
  STAFF,
  uuid,
} from './offline-fixtures';

let db: SevaDb;

beforeEach(async () => {
  db = await freshDb();
  connectionStore.setForcedOffline(false);
  connectionStore.markOnline();
  connectionStore.setWaiting(0);
});

afterEach(() => {
  jest.useRealTimers();
});

function setup(over: { forced?: boolean; catalogue?: () => CounterBootstrap; ask?: boolean } = {}) {
  const issue = jest.fn<Promise<IssueResponse>, [CounterOrderPayload]>();
  const askPrintOffline = jest.fn(async () => over.ask ?? true);
  const submitter = createCounterSubmitter({
    db,
    api: { issue },
    clock: () => NOW,
    askPrintOffline,
    staff: () => STAFF,
    counter: () => COUNTER,
    catalogue: over.catalogue ?? (() => bootstrap()),
    isForcedOffline: () => over.forced ?? false,
    newIds: idSequence(900),
  });
  return { submitter, issue, askPrintOffline };
}

describe('counter submitter', () => {
  it('saves online when the office answers', async () => {
    const { submitter, issue, askPrintOffline } = setup();
    const order = bookOrder();
    const answer = onlineAnswer(order);
    issue.mockResolvedValue(answer);

    const result = await submitter.submit(order);

    expect(result).toEqual({ mode: 'online', receipts: answer.receipts, duplicate: false });
    expect(issue).toHaveBeenCalledTimes(1);
    expect(issue).toHaveBeenCalledWith(order);
    expect(askPrintOffline).not.toHaveBeenCalled();
    expect(await pendingCount(db)).toBe(0);
    expect((await todaysReceipts(db, '2026-10-18')).map((r) => r.receiptNo)).toEqual([
      'C1-023-10-2026/000124',
      'C1-023-10-2026/000125',
      'C1-023-10-2026/000126',
    ]);
    expect((await db.get('today', order.receipts[0].clientReceiptId))?.sent).toBe(true);
    expect(connectionStore.get().status).toBe('online');
  });

  it('retries the same client order id twice on timeout, then asks to print offline', async () => {
    const { submitter, issue, askPrintOffline } = setup();
    issue
      .mockRejectedValueOnce(new FakeClientError('timeout', 0))
      .mockRejectedValueOnce(new FakeClientError('internal', 503))
      .mockRejectedValueOnce(new FakeClientError('network', 0));
    const order = bookOrder();

    const result = await submitter.submit(order);

    expect(issue).toHaveBeenCalledTimes(3);
    expect(issue.mock.calls.map(([p]) => p.clientOrderId)).toEqual([uuid(1), uuid(1), uuid(1)]);
    expect(askPrintOffline).toHaveBeenCalledTimes(1);
    expect(result.mode).toBe('offline');
  });

  it('gives each online attempt 6 seconds before it counts as a timeout', async () => {
    jest.useFakeTimers();
    const { submitter, issue, askPrintOffline } = setup({ ask: false });
    issue.mockImplementation(() => new Promise<IssueResponse>(() => undefined));

    const pending = submitter.submit(bookOrder());
    await jest.advanceTimersByTimeAsync(5999);
    expect(issue).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(issue).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(6000);
    expect(issue).toHaveBeenCalledTimes(3);
    expect(askPrintOffline).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(6000);

    await expect(pending).resolves.toEqual({ mode: 'cancelled' });
    expect(askPrintOffline).toHaveBeenCalledTimes(1);
  });

  it('prints offline with OF numbers and records what it supersedes', async () => {
    const { submitter, issue } = setup();
    issue.mockRejectedValue(new FakeClientError('network', 0));
    const order = bookOrder();

    const result = await submitter.submit(order);
    if (result.mode !== 'offline') throw new Error('expected an offline save');

    expect(result.receipts.map((r) => r.receiptNo)).toEqual([
      'OF1-023-10-2026/000001',
      'OF1-023-10-2026/000002',
      'OF1-023-10-2026/000003',
    ]);
    expect(result.receipts.map((r) => [r.position, r.count, r.totalPaise, r.orderTotalPaise])).toEqual([
      [1, 3, 61000, 82000],
      [2, 3, 10500, 82000],
      [3, 3, 10500, 82000],
    ]);
    const first = result.receipts[0];
    expect(first).toMatchObject({
      id: null,
      seriesCode: 'OF1',
      groupNo: 'G-2610-OF1-001',
      sevaDate: '2026-10-20',
      issuedAt: NOW.toISOString(),
      issuedBy: { name: 'Ramesh', staffNo: 23 },
      counterName: 'Counter 1',
      channel: 'counter',
      issuedOffline: true,
      status: 'issued',
      printCount: 0,
      prasadam: 'pending',
      payment: { mode: 'cash' },
      devotee: {
        name: 'Venkatesh Rao',
        gotra: 'Bharadwaja',
        gotraKn: 'ಭಾರದ್ವಾಜ',
        nakshatra: 'Rohini',
        nakshatraKn: 'ರೋಹಿಣಿ',
        rashi: 'Vrishabha',
        rashiKn: 'ವೃಷಭ',
      },
    });
    expect(first.lines.map((l) => [l.lineNo, l.code, l.quantity, l.unitRatePaise, l.amountPaise, l.changed])).toEqual([
      [1, 'PAA', 1, 50500, 50500, false],
      [2, 'PAN', 1, 10500, 10500, false],
    ]);
    expect(JSON.stringify(result.receipts)).not.toContain('9845012345');

    const items = await pendingItems(db);
    expect(items).toHaveLength(1);
    const item = items[0];
    if (item.kind !== 'order') throw new Error('expected an order');
    expect(item.payload.clientOrderId).toBe(uuid(900));
    expect(item.payload.supersedesClientOrderId).toBe(uuid(1));
    expect(item.payload.groupNo).toBe('G-2610-OF1-001');
    // The issuer travels with the order (the staff no. inside its OF numbers), so whoever is signed in when the
    // outbox is sent can sync it.
    expect(item.payload.issuerStaffNo).toBe(STAFF.staffNo);
    expect(item.payload.issuedAt).toBe(NOW.toISOString());
    expect(item.payload.expectedTotalPaise).toBe(82000);
    expect(item.payload.devotee.phone).toBe('+919845012345');
    expect(item.payload.receipts.map((r) => [r.runningNo, r.receiptNo])).toEqual([
      [1, 'OF1-023-10-2026/000001'],
      [2, 'OF1-023-10-2026/000002'],
      [3, 'OF1-023-10-2026/000003'],
    ]);
    expect(item.payload.receipts[0].lines.map((l) => l.cachedRatePaise)).toEqual([50500, 10500]);

    // The offline order is a new order: the office may hold the in-doubt C order with the old receipt ids and tokens.
    const oldIds = order.receipts.map((r) => r.clientReceiptId);
    const oldTokens = order.receipts.map((r) => r.qrToken);
    for (const r of item.payload.receipts) {
      expect(oldIds).not.toContain(r.clientReceiptId);
      expect(oldTokens).not.toContain(r.qrToken);
      expect(r.clientReceiptId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(isQrToken(r.qrToken)).toBe(true);
    }
    expect(result.receipts.map((r) => r.clientReceiptId)).toEqual(item.payload.receipts.map((r) => r.clientReceiptId));
    expect(result.receipts.map((r) => r.qrToken)).toEqual(item.payload.receipts.map((r) => r.qrToken));

    const local = await todaysReceipts(db, '2026-10-18');
    expect(local.map((r) => r.receiptNo)).toEqual(result.receipts.map((r) => r.receiptNo));
    expect((await db.get('today', first.clientReceiptId))?.sent).toBe(false);
    expect(connectionStore.get()).toMatchObject({ status: 'offline', since: NOW.toISOString(), waiting: 1 });
  });

  it('returns cancelled and queues nothing when the receptionist says no', async () => {
    const { submitter, issue, askPrintOffline } = setup({ ask: false });
    issue.mockRejectedValue(new FakeClientError('internal', 500));

    await expect(submitter.submit(bookOrder())).resolves.toEqual({ mode: 'cancelled' });

    expect(issue).toHaveBeenCalledTimes(3);
    expect(askPrintOffline).toHaveBeenCalledTimes(1);
    expect(await pendingCount(db)).toBe(0);
    expect(await todaysReceipts(db, '2026-10-18')).toEqual([]);
    expect(await takeOfflineNumbers(db, { series: 'OF1', year: 2026, count: 1 })).toBe(1);
  });

  it.each([
    [409, 'price_changed'],
    [409, 'seva_inactive'],
    [400, 'validation'],
    [403, 'device_unknown'],
    [401, 'unauthenticated'],
  ])('business errors never fall back to offline (%i %s)', async (status, code) => {
    const { submitter, issue, askPrintOffline } = setup();
    issue.mockRejectedValue(new FakeClientError(code, status));

    await expect(submitter.submit(bookOrder())).rejects.toMatchObject({ code, status });

    expect(issue).toHaveBeenCalledTimes(1);
    expect(askPrintOffline).not.toHaveBeenCalled();
    expect(await pendingCount(db)).toBe(0);
    expect(await takeOfflineNumbers(db, { series: 'OF1', year: 2026, count: 1 })).toBe(1);
  });

  it('goes straight to offline when Work offline is on', async () => {
    const { submitter, issue, askPrintOffline } = setup({ forced: true });

    const result = await submitter.submit(bookOrder());

    expect(result.mode).toBe('offline');
    expect(issue).not.toHaveBeenCalled();
    expect(askPrintOffline).not.toHaveBeenCalled();
    const [item] = await pendingItems(db);
    if (item.kind !== 'order') throw new Error('expected an order');
    expect(item.payload.clientOrderId).toBe(uuid(900));
    expect(item.payload).not.toHaveProperty('supersedesClientOrderId');
  });

  it('prices any-amount and changed lines from the order and marks only the changed one', async () => {
    const { submitter } = setup({ forced: true });
    const order = bookOrder();
    order.receipts = [
      {
        ...order.receipts[0],
        lines: [
          { sevaId: KARNIKE.id, quantity: 2, unitRatePaise: 10100 },
          { sevaId: 'seva-paa', quantity: 1, unitRatePaise: 40000, changeReason: 'Trustee rate' },
        ],
      },
    ];
    order.expectedTotalPaise = 60200;
    order.payment = { mode: 'upi', upiRefLast6: '123456', upiSeenConfirmed: true };

    const result = await submitter.submit(order);
    if (result.mode !== 'offline') throw new Error('expected an offline save');

    expect(result.receipts[0].lines.map((l) => [l.code, l.unitRatePaise, l.amountPaise, l.changed])).toEqual([
      ['KAR', 10100, 20200, false],
      ['PAA', 40000, 40000, true],
    ]);
    expect(result.receipts[0].prasadam).toBe('none');
    expect(result.receipts[0].payment).toEqual({ mode: 'upi', upiRefLast6: '123456' });
    const [item] = await pendingItems(db);
    if (item.kind !== 'order') throw new Error('expected an order');
    expect(item.payload.receipts[0].lines).toEqual([
      { sevaId: KARNIKE.id, quantity: 2, unitRatePaise: 10100, cachedRatePaise: null },
      { sevaId: 'seva-paa', quantity: 1, unitRatePaise: 40000, changeReason: 'Trustee rate', cachedRatePaise: 50500 },
    ]);
  });

  it.each([[undefined], ['ok'], ['\u{1F64F}\u{1F64F}']])(
    'refuses to print offline a changed line without a 3-character reason (%s), using no number (M-5)',
    async (changeReason) => {
      const { submitter } = setup({ forced: true });
      const order = bookOrder();
      order.receipts = [
        {
          ...order.receipts[0],
          lines: [{ sevaId: 'seva-paa', quantity: 1, unitRatePaise: 40000, ...(changeReason ? { changeReason } : {}) }],
        },
      ];
      order.expectedTotalPaise = 40000;

      await expect(submitter.submit(order)).rejects.toThrow('offline_reason_required');

      expect(await pendingCount(db)).toBe(0);
      expect(await takeOfflineNumbers(db, { series: 'OF1', year: 2026, count: 1 })).toBe(1);
    },
  );

  it('numbers receipts in seva-date order', async () => {
    const { submitter } = setup({ forced: true });
    const order = bookOrder();
    order.receipts = [order.receipts[2], order.receipts[0], order.receipts[1]];

    const result = await submitter.submit(order);
    if (result.mode !== 'offline') throw new Error('expected an offline save');

    expect(result.receipts.map((r) => [r.sevaDate, r.position, r.receiptNo.slice(-6)])).toEqual([
      ['2026-10-20', 1, '000001'],
      ['2026-10-21', 2, '000002'],
      ['2026-10-22', 3, '000003'],
    ]);
  });

  it('refuses to print offline when the cached rates do not give the expected total', async () => {
    const { submitter } = setup({ forced: true });
    const order = { ...bookOrder(), expectedTotalPaise: 80000 };

    await expect(submitter.submit(order)).rejects.toThrow('offline_total_mismatch');

    expect(await pendingCount(db)).toBe(0);
    expect(await takeOfflineNumbers(db, { series: 'OF1', year: 2026, count: 1 })).toBe(1);
  });

  it('refuses to print offline a seva the cached catalogue does not know', async () => {
    const { submitter } = setup({ forced: true, catalogue: () => bootstrap([KARNIKE]) });

    await expect(submitter.submit(bookOrder())).rejects.toThrow('offline_unknown_seva');

    expect(await pendingCount(db)).toBe(0);
    expect(await takeOfflineNumbers(db, { series: 'OF1', year: 2026, count: 1 })).toBe(1);
  });

  it('a second save of the same order while the first is running shares its result', async () => {
    const { submitter, issue } = setup();
    const order = bookOrder();
    let answer: (r: IssueResponse) => void = () => undefined;
    issue.mockImplementation(() => new Promise<IssueResponse>((resolve) => (answer = resolve)));

    const a = submitter.submit(order);
    const b = submitter.submit(order);
    answer(onlineAnswer(order));

    const [ra, rb] = await Promise.all([a, b]);
    expect(issue).toHaveBeenCalledTimes(1);
    expect(rb).toEqual(ra);
  });
  describe('an in-doubt order (H-3)', () => {
    function inDoubtSetup() {
      let forced = false;
      const issue = jest.fn<Promise<IssueResponse>, [CounterOrderPayload]>();
      const askPrintOffline = jest.fn(async () => false);
      const submitter = createCounterSubmitter({
        db,
        api: { issue },
        clock: () => NOW,
        askPrintOffline,
        staff: () => STAFF,
        counter: () => COUNTER,
        catalogue: () => bootstrap(),
        isForcedOffline: () => forced,
        newIds: idSequence(900),
      });
      return { submitter, issue, askPrintOffline, goOffline: () => (forced = true) };
    }

    async function timeOutThreeTimesAndSayNo(s: ReturnType<typeof inDoubtSetup>, order: CounterOrderPayload) {
      s.issue.mockRejectedValue(new FakeClientError('timeout', 0));
      await expect(s.submitter.submit(order)).resolves.toEqual({ mode: 'cancelled' });
      s.issue.mockReset();
    }

    it('an offline save of the same order after "No" supersedes the first client order id', async () => {
      const s = inDoubtSetup();
      const order = bookOrder();
      await timeOutThreeTimesAndSayNo(s, order);

      s.goOffline();
      const result = await s.submitter.submit(order);

      expect(result.mode).toBe('offline');
      const [item] = await pendingItems(db);
      if (item.kind !== 'order') throw new Error('expected an order');
      expect(item.payload.supersedesClientOrderId).toBe(uuid(1));
    });

    it('the same holds when one field was edited (the order keeps its client order id)', async () => {
      const s = inDoubtSetup();
      const order = bookOrder();
      await timeOutThreeTimesAndSayNo(s, order);

      s.goOffline();
      const edited: CounterOrderPayload = { ...order, devotee: { ...order.devotee, name: 'Venkatesh Rao K' } };
      await s.submitter.submit(edited);

      const [item] = await pendingItems(db);
      if (item.kind !== 'order') throw new Error('expected an order');
      expect(item.payload.supersedesClientOrderId).toBe(uuid(1));
    });

    it('an online save after "No" sends the same client order id and tells the caller the office already had it', async () => {
      const s = inDoubtSetup();
      const order = bookOrder();
      await timeOutThreeTimesAndSayNo(s, order);

      const stored = { ...onlineAnswer(order), duplicate: true };
      s.issue.mockResolvedValue(stored);
      const result = await s.submitter.submit(order);

      expect(s.issue).toHaveBeenCalledWith(expect.objectContaining({ clientOrderId: uuid(1) }));
      expect(result).toEqual({ mode: 'online', receipts: stored.receipts, duplicate: true });

      // Confirmed by the office: a later offline save of another order under that id supersedes nothing.
      s.goOffline();
      await s.submitter.submit(order);
      const [item] = await pendingItems(db);
      if (item.kind !== 'order') throw new Error('expected an order');
      expect(item.payload).not.toHaveProperty('supersedesClientOrderId');
    });
  });
});
