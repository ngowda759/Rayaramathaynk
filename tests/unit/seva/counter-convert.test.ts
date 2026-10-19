/**
 * @jest-environment node
 */
/**
 * Task A3-1: the conversions between the counter's wire payloads (camelCase, integer paise) and the SQL JSON contract
 * of the A2-1 functions (snake_case, rupee strings), and back from the SQL answer to the IssuedReceipt wire type with
 * the Kannada list names added (lib/seva/server/counter.ts).
 */
import { fromSqlIssue, toSqlOfflineOrder, toSqlOrder } from '@/lib/seva/server/counter';
import { SevaError } from '@/lib/seva/errors';
import type { CounterOrderPayload, OfflineOrderPayload } from '@/types/seva';

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }));

const SEVA_PAA = '11111111-1111-4111-8111-111111111111';
const SEVA_PAN = '22222222-2222-4222-8222-222222222222';
const SEVA_KAR = '33333333-3333-4333-8333-333333333333';

function id(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function qr(n: number): string {
  return `TOKEN${String(n).padStart(17, '0')}`;
}

/** The Design Book example: Paaduka + Panchamrita on day 1 (610), Panchamrita on days 2 and 3 (105 each) = 820. */
function bookOrder(): CounterOrderPayload {
  return {
    clientOrderId: id(1),
    devotee: {
      name: 'Venkatesh Rao',
      gotra: { text: 'Bharadwaja', id: 2 },
      nakshatra: { id: 4 },
      rashi: { text: 'Vrishabha' },
      phone: '+919845012345',
    },
    receipts: [
      {
        clientReceiptId: id(11),
        sevaDate: '2026-10-20',
        qrToken: qr(11),
        lines: [
          { sevaId: SEVA_PAA, quantity: 1 },
          { sevaId: SEVA_PAN, quantity: 1 },
        ],
      },
      { clientReceiptId: id(12), sevaDate: '2026-10-21', qrToken: qr(12), lines: [{ sevaId: SEVA_PAN, quantity: 1 }] },
      {
        clientReceiptId: id(13),
        sevaDate: '2026-10-22',
        qrToken: qr(13),
        lines: [{ sevaId: SEVA_KAR, quantity: 2, unitRatePaise: 5050, changeReason: 'Devotee offered more' }],
      },
    ],
    payment: { mode: 'cash', cashReceivedPaise: 100000 },
    expectedTotalPaise: 82000,
  };
}

function offlineOrder(): OfflineOrderPayload {
  const base = bookOrder();
  return {
    ...base,
    issuerStaffNo: 23,
    issuedAt: '2026-10-18T05:12:00.000Z',
    groupNo: 'G-2610-OF1-007',
    receipts: base.receipts.map((r, i) => ({
      ...r,
      runningNo: 41 + i,
      receiptNo: `OF1-023-10-2026/${String(41 + i).padStart(6, '0')}`,
      lines: r.lines.map((l) => ({ ...l, cachedRatePaise: l.sevaId === SEVA_KAR ? null : l.sevaId === SEVA_PAA ? 50500 : 10500 })),
    })),
  };
}

/** One receipt of seva_order_json in snake_case with numeric strings, as the SQL function answers it. */
function sqlReceipt(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: id(600),
    client_receipt_id: id(11),
    receipt_no: 'C1-023-10-2026/000124',
    series_code: 'C1',
    seva_date: '2026-10-20',
    business_date: '2026-10-18',
    group_no: 'G-2610-0042',
    position: 1,
    count: 3,
    order_total: '820.00',
    total: '610.00',
    lines: [
      {
        line_no: 1,
        seva_id: SEVA_PAA,
        code: 'PAA',
        name_en: 'Paaduka Pooja',
        name_kn: 'ಪಾದುಕಾ ಪೂಜೆ',
        quantity: 1,
        catalogue_rate: '505.00',
        unit_rate: '505.00',
        amount: '505.00',
        changed: false,
        change_reason: null,
        prasadam_items: null,
      },
      {
        line_no: 2,
        seva_id: SEVA_PAN,
        code: 'PAN',
        name_en: 'Panchamrita Abhisheka',
        name_kn: null,
        quantity: 1,
        catalogue_rate: '105.00',
        unit_rate: '105.00',
        amount: '105.00',
        changed: false,
        change_reason: null,
        prasadam_items: 'Tirtha, prasada',
      },
    ],
    payment: { mode: 'cash', upi_ref_last6: null, cash_received: '1000.00', change_returned: '180.00' },
    devotee: {
      name: 'Venkatesh Rao',
      gotra: 'Bharadwaja',
      gotra_id: 2,
      nakshatra_id: 4,
      nakshatra_text: null,
      rashi_id: null,
      rashi_text: 'Vrishabha',
    },
    qr_token: qr(11),
    issued_at: '2026-10-18T10:42:00+05:30',
    issued_by: { name: 'Ramesh', staff_no: 23 },
    counter_name: 'Counter 1',
    channel: 'counter',
    issued_offline: false,
    status: 'issued',
    cancel_reason_code: null,
    refund_state: 'none',
    print_count: 0,
    prasadam: 'pending',
    has_changed_amount: false,
    replaces_receipt_id: null,
    ...over,
  };
}

function sqlOrder(receipts: Record<string, unknown>[] = [sqlReceipt()]): Record<string, unknown> {
  return { order_id: id(500), group_no: 'G-2610-0042', duplicate: false, receipts };
}

describe('toSqlOrder', () => {
  it('passes rupee strings and the expected total in the SQL JSON contract', () => {
    expect(toSqlOrder(bookOrder())).toEqual({
      client_order_id: id(1),
      supersedes_client_order_id: null,
      expected_total: '820.00',
      devotee: {
        name: 'Venkatesh Rao',
        gotra: 'Bharadwaja',
        gotra_id: 2,
        nakshatra_id: 4,
        nakshatra_text: null,
        rashi_id: null,
        rashi_text: 'Vrishabha',
        phone_e164: '+919845012345',
      },
      payment: { mode: 'cash', cash_received: '1000.00', upi_ref_last6: null, upi_seen_confirmed: null },
      receipts: [
        {
          client_receipt_id: id(11),
          seva_date: '2026-10-20',
          qr_token: qr(11),
          lines: [
            { seva_id: SEVA_PAA, quantity: 1, unit_rate: null, change_reason: null },
            { seva_id: SEVA_PAN, quantity: 1, unit_rate: null, change_reason: null },
          ],
        },
        {
          client_receipt_id: id(12),
          seva_date: '2026-10-21',
          qr_token: qr(12),
          lines: [{ seva_id: SEVA_PAN, quantity: 1, unit_rate: null, change_reason: null }],
        },
        {
          client_receipt_id: id(13),
          seva_date: '2026-10-22',
          qr_token: qr(13),
          lines: [{ seva_id: SEVA_KAR, quantity: 2, unit_rate: '50.50', change_reason: 'Devotee offered more' }],
        },
      ],
    });
  });

  it('carries UPI details and the order a save replaces', () => {
    const order: CounterOrderPayload = {
      ...bookOrder(),
      devotee: { name: 'Lakshmi' },
      payment: { mode: 'upi', upiRefLast6: '119042', upiSeenConfirmed: true },
      supersedesClientOrderId: id(9),
    };
    const sql = toSqlOrder(order);
    expect(sql.supersedes_client_order_id).toBe(id(9));
    expect(sql.payment).toEqual({ mode: 'upi', cash_received: null, upi_ref_last6: '119042', upi_seen_confirmed: true });
    expect(sql.devotee).toEqual({
      name: 'Lakshmi',
      gotra: null,
      gotra_id: null,
      nakshatra_id: null,
      nakshatra_text: null,
      rashi_id: null,
      rashi_text: null,
      phone_e164: null,
    });
  });
});

describe('toSqlOfflineOrder', () => {
  it('adds the issuer, issue time, group label, numbers and cached rates', () => {
    const sql = toSqlOfflineOrder(offlineOrder());
    expect(sql).toMatchObject({
      client_order_id: id(1),
      expected_total: '820.00',
      issuer_staff_no: 23,
      issued_at: '2026-10-18T05:12:00.000Z',
      group_no: 'G-2610-OF1-007',
    });
    const receipts = sql.receipts as Record<string, unknown>[];
    expect(receipts.map((r) => [r.running_no, r.receipt_no])).toEqual([
      [41, 'OF1-023-10-2026/000041'],
      [42, 'OF1-023-10-2026/000042'],
      [43, 'OF1-023-10-2026/000043'],
    ]);
    expect(receipts[0].lines).toEqual([
      { seva_id: SEVA_PAA, quantity: 1, unit_rate: null, change_reason: null, cached_rate: '505.00' },
      { seva_id: SEVA_PAN, quantity: 1, unit_rate: null, change_reason: null, cached_rate: '105.00' },
    ]);
    expect(receipts[2].lines).toEqual([
      { seva_id: SEVA_KAR, quantity: 2, unit_rate: '50.50', change_reason: 'Devotee offered more', cached_rate: null },
    ]);
  });
});

describe('fromSqlIssue', () => {
  it('converts the SQL answer to paise and adds Kannada names', () => {
    const answer = fromSqlIssue(sqlOrder());
    expect(answer).toEqual({
      orderId: id(500),
      groupNo: 'G-2610-0042',
      duplicate: false,
      receipts: [
        {
          id: id(600),
          clientReceiptId: id(11),
          receiptNo: 'C1-023-10-2026/000124',
          seriesCode: 'C1',
          sevaDate: '2026-10-20',
          groupNo: 'G-2610-0042',
          position: 1,
          count: 3,
          orderTotalPaise: 82000,
          totalPaise: 61000,
          lines: [
            {
              lineNo: 1,
              sevaId: SEVA_PAA,
              code: 'PAA',
              nameEn: 'Paaduka Pooja',
              nameKn: 'ಪಾದುಕಾ ಪೂಜೆ',
              quantity: 1,
              unitRatePaise: 50500,
              amountPaise: 50500,
              changed: false,
              prasadamItems: null,
            },
            {
              lineNo: 2,
              sevaId: SEVA_PAN,
              code: 'PAN',
              nameEn: 'Panchamrita Abhisheka',
              nameKn: null,
              quantity: 1,
              unitRatePaise: 10500,
              amountPaise: 10500,
              changed: false,
              prasadamItems: 'Tirtha, prasada',
            },
          ],
          payment: { mode: 'cash' },
          devotee: {
            name: 'Venkatesh Rao',
            gotra: 'Bharadwaja',
            gotraKn: 'ಭಾರದ್ವಾಜ',
            nakshatra: 'Rohini',
            nakshatraKn: 'ರೋಹಿಣಿ',
            rashi: 'Vrishabha',
          },
          qrToken: qr(11),
          issuedAt: '2026-10-18T05:12:00.000Z',
          issuedBy: { name: 'Ramesh', staffNo: 23 },
          counterName: 'Counter 1',
          channel: 'counter',
          issuedOffline: false,
          status: 'issued',
          printCount: 0,
          prasadam: 'pending',
        },
      ],
    });
  });

  it('keeps the UPI reference, a rashi picked from the list and a duplicate answer', () => {
    const answer = fromSqlIssue({
      ...sqlOrder([
        sqlReceipt({
          payment: { mode: 'upi', upi_ref_last6: '119042', cash_received: null, change_returned: null },
          devotee: { name: 'Lakshmi', gotra: null, gotra_id: null, nakshatra_id: null, nakshatra_text: 'Unknown', rashi_id: 2, rashi_text: null },
          issued_by: { name: 'Ramesh', staff_no: null },
          issued_offline: true,
          print_count: 1,
        }),
      ]),
      duplicate: true,
    });
    expect(answer.duplicate).toBe(true);
    const [r] = answer.receipts;
    expect(r.payment).toEqual({ mode: 'upi', upiRefLast6: '119042' });
    expect(r.devotee).toEqual({ name: 'Lakshmi', nakshatra: 'Unknown', rashi: 'Vrishabha', rashiKn: 'ವೃಷಭ' });
    expect(r.issuedBy).toEqual({ name: 'Ramesh', staffNo: null });
    expect(r.issuedOffline).toBe(true);
    expect(r.printCount).toBe(1);
  });

  it('refuses an answer that is not the SQL contract with an internal error', () => {
    for (const bad of [null, 'text', { order_id: id(1) }, sqlOrder([sqlReceipt({ total: 'abc' })]), sqlOrder([sqlReceipt({ lines: null })])]) {
      expect(() => fromSqlIssue(bad)).toThrow(SevaError);
      try {
        fromSqlIssue(bad);
      } catch (error) {
        expect((error as SevaError).code).toBe('internal');
      }
    }
  });
});
