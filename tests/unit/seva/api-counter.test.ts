/**
 * @jest-environment node
 */
/**
 * Task A3-1: the counter routes - me, bootstrap, orders, sync, prints, heartbeat, devices - and their browser clients.
 * The guard (requireSevaActor), the RPC wrapper (callRpc), Supabase reads, the identity adapter and Firestore are
 * mocked; each test calls the route handler with a NextRequest.
 */
import { NextRequest } from 'next/server';
import { SevaError } from '@/lib/seva/errors';
import { sevaErrorResponse } from '@/lib/seva/server/respond';
import type { SevaActor } from '@/lib/seva/permissions';
import type { CounterOrderPayload, OfflineOrderPayload, OutboxItem } from '@/types/seva';

jest.mock('server-only', () => ({}), { virtual: true });

// ---- The guard --------------------------------------------------------------------------------------------------------
const mockRequire = jest.fn();
jest.mock('@/lib/seva/server/auth', () => ({
  SEVA_DEVICE_HEADER: 'x-seva-device',
  requireSevaActor: (...args: unknown[]) => mockRequire(...args),
}));

// ---- SQL functions ----------------------------------------------------------------------------------------------------
const mockCallRpc = jest.fn();
jest.mock('@/lib/seva/server/rpc', () => ({ callRpc: (...args: unknown[]) => mockCallRpc(...args) }));

// ---- Supabase table reads: an in-memory stand-in for from(table).select().eq().in().gte().order() -----------------
type Row = Record<string, unknown>;
const mockTables: Record<string, Row[]> = {};
const mockReads: { table: string; columns: string; filters: [string, string, unknown][] }[] = [];

function mockFakeSupabase() {
  return {
    from(table: string) {
      const call = { table, columns: '', filters: [] as [string, string, unknown][] };
      const run = (): Row[] => {
        mockReads.push(call);
        return (mockTables[table] ?? []).filter((row) =>
          call.filters.every(([op, column, value]) => {
            if (op === 'eq') return row[column] === value;
            if (op === 'in') return (value as unknown[]).includes(row[column]);
            if (op === 'gte') return String(row[column]) >= String(value);
            return true;
          }),
        );
      };
      const query = {
        select(columns: string) {
          call.columns = columns;
          return query;
        },
        eq(column: string, value: unknown) {
          call.filters.push(['eq', column, value]);
          return query;
        },
        in(column: string, value: unknown[]) {
          call.filters.push(['in', column, value]);
          return query;
        },
        gte(column: string, value: unknown) {
          call.filters.push(['gte', column, value]);
          return query;
        },
        order() {
          return query;
        },
        async maybeSingle() {
          return { data: run()[0] ?? null, error: null };
        },
        then(resolve: (v: { data: Row[]; error: null }) => unknown, reject?: (e: unknown) => unknown) {
          return Promise.resolve({ data: run(), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockFakeSupabase() }));

// ---- Identity adapter: Firestore users/{uid} --------------------------------------------------------------------------
const mockProfiles: Record<string, { role: unknown; isActive: boolean } | null> = {};
const mockGetAccessProfile = jest.fn(async (uid: string) => mockProfiles[uid] ?? null);
jest.mock('@/lib/seva/server/identity', () => ({
  getIdentityAdapter: () => ({ getAccessProfile: (uid: string) => mockGetAccessProfile(uid) }),
}));

// ---- Firestore settings/financeSettings ------------------------------------------------------------------------------
const mockFinance: { doc: Row | undefined } = { doc: undefined };
jest.mock('@/lib/admin-firebase', () => ({
  getAdminFirestore: async () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = name === 'settings' && id === 'financeSettings' ? mockFinance.doc : undefined;
          return { exists: data !== undefined, data: () => data };
        },
      }),
    }),
  }),
}));

import { GET as meGet } from '@/app/api/seva/me/route';
import { GET as bootstrapGet } from '@/app/api/seva/counter/bootstrap/route';
import { POST as ordersPost } from '@/app/api/seva/counter/orders/route';
import { POST as syncPost } from '@/app/api/seva/counter/sync/route';
import { POST as printsPost } from '@/app/api/seva/counter/prints/route';
import { POST as heartbeatPost } from '@/app/api/seva/counter/heartbeat/route';
import { POST as devicesPost } from '@/app/api/seva/counter/devices/route';
import { counterApi } from '@/services/seva/counter.service';
import { meApi } from '@/services/seva/me.service';

// ---- Fixtures -----------------------------------------------------------------------------------------------------------
/** 10:42 IST on Sun 18 Oct 2026. */
const NOW = new Date('2026-10-18T05:12:00.000Z');
const DEVICE = { id: '6f9619ff-8b86-4d11-b42d-00c04fc964ff', counterId: 1 };
const SEVA_PAA = '11111111-1111-4111-8111-111111111111';
const SEVA_PAN = '22222222-2222-4222-8222-222222222222';
const SEVA_ONLINE = '44444444-4444-4444-8444-444444444444';
const SEVA_OFF = '55555555-5555-4555-8555-555555555555';
const SEVA_KAR = '33333333-3333-4333-8333-333333333333';

const RAMESH: SevaActor = { staffId: 'staff-ramesh', uid: 'uid-ramesh', role: 'receptionist', viewOnly: false, staffNo: 23, name: 'Ramesh' };
const SURESH: SevaActor = { staffId: 'staff-suresh', uid: 'uid-suresh', role: 'receptionist', viewOnly: false, staffNo: 24, name: 'Suresh' };
const ADMIN: SevaActor = { staffId: 'staff-admin', uid: 'uid-admin', role: 'temple_admin', viewOnly: false, staffNo: 1, name: 'Admin' };

function id(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function qr(n: number): string {
  return `TOKEN${String(n).padStart(17, '0')}`;
}

function allow(actor: SevaActor = RAMESH, device: { id: string; counterId: number } | null = DEVICE) {
  return { ok: true as const, actor, device };
}

function denyWith(code: 'device_required' | 'forbidden') {
  return { ok: false as const, response: sevaErrorResponse(new SevaError(code)) };
}

function request(path: string, init: { method?: string; body?: unknown; rawBody?: string } = {}): NextRequest {
  const body = init.rawBody ?? (init.body === undefined ? undefined : JSON.stringify(init.body));
  return new NextRequest(`http://localhost/api/seva/${path}`, {
    method: init.method ?? (body === undefined ? 'GET' : 'POST'),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body,
  });
}

async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

function bookOrder(): CounterOrderPayload {
  return {
    clientOrderId: id(1),
    devotee: { name: 'Venkatesh Rao', nakshatra: { id: 4 } },
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
      { clientReceiptId: id(13), sevaDate: '2026-10-22', qrToken: qr(13), lines: [{ sevaId: SEVA_PAN, quantity: 1 }] },
    ],
    payment: { mode: 'cash', cashReceivedPaise: 100000 },
    expectedTotalPaise: 82000,
  };
}

function offlineOrder(n: number, issuerStaffNo = 23): OfflineOrderPayload {
  return {
    clientOrderId: id(700 + n),
    devotee: { name: `Devotee ${n}` },
    payment: { mode: 'cash' },
    expectedTotalPaise: 10500,
    issuerStaffNo,
    issuedAt: '2026-10-18T05:00:00.000Z',
    groupNo: `G-2610-OF1-${String(n).padStart(3, '0')}`,
    receipts: [
      {
        clientReceiptId: id(800 + n),
        sevaDate: '2026-10-20',
        qrToken: qr(800 + n),
        runningNo: n,
        receiptNo: `OF1-${String(issuerStaffNo).padStart(3, '0')}-10-2026/${String(n).padStart(6, '0')}`,
        lines: [{ sevaId: SEVA_PAN, quantity: 1, cachedRatePaise: 10500 }],
      },
    ],
  };
}

function cancelItem(seq: number, clientReceiptIds: string[], cancelledByStaffNo = 23): OutboxItem {
  return { seq, kind: 'cancel', clientReceiptIds, reasonCode: 'wrong_seva', at: '2026-10-18T05:05:00.000Z', cancelledByStaffNo };
}

/** seva_order_json as the SQL functions answer it (one receipt). */
function sqlOrder(over: { orderId?: string; receiptNo?: string; clientReceiptId?: string; duplicate?: boolean } = {}): Row {
  return {
    order_id: over.orderId ?? id(500),
    group_no: 'G-2610-0042',
    duplicate: over.duplicate ?? false,
    receipts: [
      {
        id: id(600),
        client_receipt_id: over.clientReceiptId ?? id(11),
        receipt_no: over.receiptNo ?? 'C1-023-10-2026/000124',
        series_code: 'C1',
        seva_date: '2026-10-20',
        business_date: '2026-10-18',
        group_no: 'G-2610-0042',
        position: 1,
        count: 1,
        order_total: '820.00',
        total: '610.00',
        lines: [
          {
            line_no: 1,
            seva_id: SEVA_PAA,
            code: 'PAA',
            name_en: 'Paaduka Pooja',
            name_kn: null,
            quantity: 1,
            catalogue_rate: '505.00',
            unit_rate: '505.00',
            amount: '505.00',
            changed: false,
            change_reason: null,
            prasadam_items: null,
          },
        ],
        payment: { mode: 'cash', upi_ref_last6: null, cash_received: '1000.00', change_returned: '180.00' },
        devotee: { name: 'Venkatesh Rao', gotra: null, gotra_id: null, nakshatra_id: 4, nakshatra_text: null, rashi_id: null, rashi_text: null },
        qr_token: qr(11),
        issued_at: '2026-10-18T10:42:00+05:30',
        issued_by: { name: 'Ramesh', staff_no: 23 },
        counter_name: 'Counter 1',
        channel: 'counter',
        issued_offline: false,
        status: 'issued',
        print_count: 0,
        prasadam: 'pending',
      },
    ],
  };
}

function resetTables(): void {
  for (const key of Object.keys(mockTables)) delete mockTables[key];
  for (const key of Object.keys(mockProfiles)) delete mockProfiles[key];
  mockTables.counters = [{ id: 1, name: 'Counter 1' }];
  mockTables.receipt_series = [
    { code: 'C1', kind: 'counter_online', counter_id: 1 },
    { code: 'OF1', kind: 'counter_offline', counter_id: 1 },
    { code: 'W', kind: 'online', counter_id: null },
  ];
  mockTables.receipt_series_years = [
    { series_code: 'C1', year: 2026, last_no: 123 },
    { series_code: 'OF1', year: 2026, last_no: 7 },
    { series_code: 'C1', year: 2027, last_no: 999 },
  ];
  mockTables.staff = [
    { id: 'staff-ramesh', staff_no: 23, firebase_uid: 'uid-ramesh', status: 'active' },
    { id: 'staff-suresh', staff_no: 24, firebase_uid: 'uid-suresh', status: 'active' },
  ];
  mockProfiles['uid-ramesh'] = { role: 'receptionist', isActive: true };
  mockProfiles['uid-suresh'] = { role: 'receptionist', isActive: true };
  mockFinance.doc = undefined;
}

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
  jest.clearAllMocks();
  // clearAllMocks keeps implementations; each test sets its own SQL answers.
  mockCallRpc.mockReset();
  mockReads.length = 0;
  resetTables();
  mockRequire.mockResolvedValue(allow());
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

afterEach(() => {
  jest.useRealTimers();
  errorSpy.mockRestore();
});

// =====================================================================================================================
describe('POST /api/seva/counter/orders', () => {
  it('passes rupee strings and the expected total to seva_issue_counter_order', async () => {
    mockCallRpc.mockResolvedValue(sqlOrder());
    const req = request('counter/orders', { body: bookOrder() });
    const res = await ordersPost(req);

    expect(res.status).toBe(200);
    expect(mockRequire).toHaveBeenCalledWith(req, 'counter.issue', { device: 'required' });
    // One issue call; the admins' lists are read alongside for the slip's Kannada names (A4P-5).
    expect(mockCallRpc.mock.calls.map(([fn]) => fn).sort()).toEqual(['seva_issue_counter_order', 'seva_list_items_get']);
    expect(mockCallRpc).toHaveBeenCalledWith('seva_issue_counter_order', {
      p_order: expect.objectContaining({
        client_order_id: id(1),
        expected_total: '820.00',
        payment: expect.objectContaining({ mode: 'cash', cash_received: '1000.00' }),
        receipts: expect.arrayContaining([
          expect.objectContaining({ lines: expect.arrayContaining([expect.objectContaining({ unit_rate: null })]) }),
        ]),
      }),
      p_staff_id: RAMESH.staffId,
      p_device_id: DEVICE.id,
    });
    const body = await json(res);
    expect(body).toMatchObject({ orderId: id(500), groupNo: 'G-2610-0042', duplicate: false });
    expect((body.receipts as Row[])[0]).toMatchObject({ totalPaise: 61000, orderTotalPaise: 82000, devotee: { nakshatraKn: 'ರೋಹಿಣಿ' } });
  });

  it('prints the Kannada names the admins keep in seva_list_items: a corrected nakshatra and an added gotra', async () => {
    const order = sqlOrder();
    const receipt = (order.receipts as Row[])[0];
    receipt.devotee = { ...(receipt.devotee as Row), gotra: 'Vyaghrapada', gotra_id: 1000, nakshatra_id: 4, rashi_id: 2 };
    const listRow = (kind: string, itemId: number, nameEn: string, nameKn: string) => ({
      kind,
      item_id: itemId,
      name_en: nameEn,
      name_kn: nameKn,
      kn_checked: true,
      active: true,
      display_order: itemId,
    });
    mockCallRpc.mockImplementation(async (fn: string) =>
      fn === 'seva_list_items_get'
        ? [
            listRow('gotra', 1000, 'Vyaghrapada', 'ವ್ಯಾಘ್ರಪಾದ'),
            listRow('nakshatra', 4, 'Rohini', 'ರೋಹಿಣೀ'),
            listRow('rashi', 2, 'Vrishabha', 'ವೃಷಭ ರಾಶಿ'),
          ]
        : order,
    );
    const res = await ordersPost(request('counter/orders', { body: bookOrder() }));

    expect(res.status).toBe(200);
    const body = await json(res);
    expect((body.receipts as Row[])[0].devotee).toEqual({
      name: 'Venkatesh Rao',
      gotra: 'Vyaghrapada',
      gotraKn: 'ವ್ಯಾಘ್ರಪಾದ',
      nakshatra: 'Rohini',
      nakshatraKn: 'ರೋಹಿಣೀ',
      rashi: 'Vrishabha',
      rashiKn: 'ವೃಷಭ ರಾಶಿ',
    });
  });

  it('answers 400 validation for a bad body', async () => {
    for (const req of [
      request('counter/orders', { body: {} }),
      request('counter/orders', { body: { ...bookOrder(), expectedTotalPaise: -1 } }),
      request('counter/orders', { rawBody: 'not json' }),
    ]) {
      const res = await ordersPost(req);
      expect(res.status).toBe(400);
      const body = await json(res);
      expect(body).toMatchObject({ error: { code: 'validation' } });
      expect(typeof (body.error as Row).message).toBe('string');
    }
    expect(mockCallRpc).not.toHaveBeenCalled();
  });

  it('answers 409 with a plain message for price_changed', async () => {
    mockCallRpc.mockRejectedValue(new SevaError('price_changed', { expected: '820.00', actual: '850.00' }));
    const res = await ordersPost(request('counter/orders', { body: bookOrder() }));
    expect(res.status).toBe(409);
    expect(await json(res)).toMatchObject({ error: { code: 'price_changed', message: 'The rate changed - check the total.' } });
  });

  it('passes through the guard response when the device header is missing', async () => {
    // A fresh response per call: a response body can be read once.
    mockRequire.mockImplementation(async () => denyWith('device_required'));
    const calls: [string, (req: NextRequest) => Promise<Response>, NextRequest][] = [
      ['orders', ordersPost, request('counter/orders', { body: bookOrder() })],
      ['bootstrap', bootstrapGet, request('counter/bootstrap')],
      ['sync', syncPost, request('counter/sync', { body: { items: [{ seq: 1, kind: 'order', payload: offlineOrder(1) }] } })],
      ['prints', printsPost, request('counter/prints', { body: { receiptIds: [id(600)] } })],
      ['heartbeat', heartbeatPost, request('counter/heartbeat', { body: { outboxCount: 0, clockSkewMs: 0, appVersion: 'v' } })],
    ];
    for (const [name, handler, req] of calls) {
      const res = await handler(req);
      expect({ name, status: res.status, body: await json(res) }).toEqual({
        name,
        status: 403,
        body: { error: expect.objectContaining({ code: 'device_required' }) },
      });
    }
    expect(mockCallRpc).not.toHaveBeenCalled();
    expect(mockReads).toEqual([]);
  });
});

// =====================================================================================================================
describe('GET /api/seva/counter/bootstrap', () => {
  function seedBootstrap(): void {
    const seva = (p: Row): Row => ({
      code: null,
      name_kn: null,
      any_amount: false,
      multi_date: false,
      allow_amount_change: true,
      prasadam_given: true,
      prasadam_items: null,
      active: true,
      category: 'Pooja',
      income_ledger: null,
      ...p,
    });
    mockTables.sevas = [
      seva({ id: SEVA_PAN, code: 'PAN', name: 'Panchamrita Abhisheka', name_kn: 'ಪಂಚಾಮೃತ ಅಭಿಷೇಕ', amount: 105, display_order: 2, visibility: 'both', multi_date: true }),
      seva({ id: SEVA_PAA, code: 'PAA', name: 'Paaduka Pooja', amount: '505.00', display_order: 1, visibility: 'counter' }),
      seva({ id: SEVA_ONLINE, code: 'ONL', name: 'Online only', amount: 100, display_order: 3, visibility: 'online' }),
      seva({ id: SEVA_OFF, code: 'OFF', name: 'Switched off', amount: 100, display_order: 4, visibility: 'both', active: false }),
      seva({ id: SEVA_KAR, code: 'KAR', name: 'Other Seva / Karnike', amount: 0, any_amount: true, display_order: 5, visibility: 'counter', income_ledger: 'Karnike' }),
    ];
    mockTables.seva_settings = [
      {
        id: 1,
        temple_name_en: 'SAMPLE - Temple',
        temple_name_kn: 'SAMPLE - ಮಠ',
        address_line1: 'Line 1',
        address_line2: 'Line 2',
        registration_line: null,
        photo_left_url: null,
        photo_right_url: 'https://site.example/right.png',
        footer_line1: 'Footer 1',
        footer_line2: 'Footer 2',
        footer_blessing: 'Blessing',
        print_gotra: true,
        print_nakshatra: true,
        print_rashi: false,
        cancel_window_minutes: 30,
        amount_change_reason_required: true,
        counter_days_ahead: 365,
        cash_difference_note_required: true,
      },
    ];
    mockTables.festival_days = [
      {
        name_en: 'Aradhane',
        name_kn: 'ಆರಾಧನೆ',
        active: true,
        festival_day_dates: [{ day: '2026-10-19' }, { day: '2026-10-17' }, { day: '2026-10-18' }],
      },
      { name_en: 'Past festival', name_kn: null, active: true, festival_day_dates: [{ day: '2026-10-01' }] },
      { name_en: 'Switched off', name_kn: null, active: false, festival_day_dates: [{ day: '2026-12-01' }] },
    ];
    mockCallRpc.mockImplementation(async (fn: string) => {
      if (fn === 'seva_prepare_day_close') {
        return {
          status: 'open',
          opening_float: '500.00',
          receipts: 4,
          cash_expected: '1320.00',
          upi_expected: '210.00',
          denominations: [
            { kind: 'note', value: '500.00' },
            { kind: 'coin', value: '10.00' },
          ],
        };
      }
      if (fn === 'seva_offline_group_floor') return 5;
      if (fn === 'seva_note_counter_upi') return false;
      throw new Error(`unexpected ${fn}`);
    });
  }

  function upiNotes(): Row[] {
    return mockCallRpc.mock.calls.filter(([fn]) => fn === 'seva_note_counter_upi').map(([, args]) => args as Row);
  }

  it('bootstrap leaves out online-only sevas and past festival chips', async () => {
    seedBootstrap();
    const req = request('counter/bootstrap');
    const res = await bootstrapGet(req);
    expect(res.status).toBe(200);
    expect(mockRequire).toHaveBeenCalledWith(req, 'counter.issue', { device: 'required' });
    const body = await json(res);
    expect((body.catalogue as Row[]).map((s) => [s.key, s.code])).toEqual([
      [1, 'PAA'],
      [2, 'PAN'],
      [5, 'KAR'],
    ]);
    expect((body.catalogue as Row[])[2]).toEqual({
      id: SEVA_KAR,
      code: 'KAR',
      key: 5,
      nameEn: 'Other Seva / Karnike',
      nameKn: null,
      ratePaise: null,
      multiDate: false,
      allowAmountChange: true,
      prasadamGiven: true,
      prasadamItems: null,
      visibility: 'counter',
      active: true,
      category: 'Pooja',
      incomeLedger: 'Karnike',
    });
    expect(body.festivalChips).toEqual([{ name: 'Aradhane', nameKn: 'ಆರಾಧನೆ', dates: ['2026-10-18', '2026-10-19'] }]);
  });

  it('bootstrap disables UPI when no UPI id is configured', async () => {
    for (const doc of [undefined, { upi: { enabled: true, id: '  ', displayName: 'Matha' } }, { upi: { enabled: false, id: 'temple@upi' } }]) {
      seedBootstrap();
      mockFinance.doc = doc;
      const body = await json(await bootstrapGet(request('counter/bootstrap')));
      expect({ doc, upi: body.upi, reason: body.upiDisabledReason }).toEqual({ doc, upi: null, reason: 'not_configured' });
    }
    seedBootstrap();
    mockFinance.doc = { upi: { enabled: true, id: ' temple@upi ', displayName: 'Sri Rayara Matha' } };
    const body = await json(await bootstrapGet(request('counter/bootstrap')));
    expect(body.upi).toEqual({ vpa: 'temple@upi', payeeName: 'Sri Rayara Matha' });
    expect(body.upiDisabledReason).toBeNull();
  });

  it('bootstrap records the UPI payee it read so a change is noticed (A3 security gate H-1)', async () => {
    seedBootstrap();
    mockCallRpc.mockClear();
    mockFinance.doc = { upi: { enabled: true, id: 'temple@upi', displayName: 'Sri Rayara Matha' } };
    expect((await bootstrapGet(request('counter/bootstrap'))).status).toBe(200);
    expect(upiNotes()).toEqual([{ p_vpa: 'temple@upi', p_payee_name: 'Sri Rayara Matha' }]);

    // UPI switched off is recorded too.
    mockCallRpc.mockClear();
    mockFinance.doc = { upi: { enabled: false, id: 'temple@upi' } };
    await bootstrapGet(request('counter/bootstrap'));
    expect(upiNotes()).toEqual([{ p_vpa: null, p_payee_name: null }]);

    // If the payee cannot be recorded, the counter gets no UPI QR at all: the bootstrap fails and the PC keeps its
    // last good copy.
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockFinance.doc = { upi: { enabled: true, id: 'someone@ybl', displayName: 'Someone' } };
    const base = mockCallRpc.getMockImplementation();
    mockCallRpc.mockImplementation(async (fn: string, args: Row) => {
      if (fn === 'seva_note_counter_upi') throw new SevaError('internal');
      return base?.(fn, args);
    });
    const failed = await bootstrapGet(request('counter/bootstrap'));
    expect(failed.status).toBe(500);
    expect(JSON.stringify(await json(failed))).not.toContain('someone@ybl');
    errorLog.mockRestore();
  });

  it('bootstrap returns lastOfNo and lastOfGroupNo', async () => {
    seedBootstrap();
    const body = await json(await bootstrapGet(request('counter/bootstrap')));
    expect(body).toMatchObject({
      counter: { id: 1, name: 'Counter 1', onlineSeries: 'C1', offlineSeries: 'OF1' },
      nextNumbers: [
        { series: 'C1', nextRunningNo: 124 },
        { series: 'OF1', nextRunningNo: 8 },
      ],
      lastOfNo: 7,
      lastOfGroupNo: 5,
      serverTime: NOW.toISOString(),
    });
    // The group floor is read for this device at the instant the answer reports, so the counter keys it by that IST month.
    expect(mockCallRpc).toHaveBeenCalledWith('seva_offline_group_floor', {
      p_counter_id: 1,
      p_device_id: DEVICE.id,
      p_at: NOW.toISOString(),
    });
  });

  it('bootstrap carries the slip, rules, denominations and today\'s totals', async () => {
    seedBootstrap();
    process.env.NEXT_PUBLIC_SITE_URL = 'https://matha.example/';
    const body = await json(await bootstrapGet(request('counter/bootstrap')));
    expect(body.slip).toEqual({
      templeNameEn: 'SAMPLE - Temple',
      templeNameKn: 'SAMPLE - ಮಠ',
      addressLine1: 'Line 1',
      addressLine2: 'Line 2',
      registrationLine: null,
      photoLeftUrl: null,
      photoRightUrl: 'https://site.example/right.png',
      footerLine1: 'Footer 1',
      footerLine2: 'Footer 2',
      footerBlessing: 'Blessing',
      printGotra: true,
      printNakshatra: true,
      printRashi: false,
    });
    expect(body.rules).toEqual({ cancelWindowMinutes: 30, amountChangeReasonRequired: true, counterDaysAhead: 365, cashDifferenceNoteRequired: true });
    expect(body.denominations).toEqual([
      { kind: 'note', valuePaise: 50000 },
      { kind: 'coin', valuePaise: 1000 },
    ]);
    expect(body.today).toEqual({ businessDate: '2026-10-18', receipts: 4, cashPaise: 82000, upiPaise: 21000, dayClosed: false });
    expect(mockCallRpc).toHaveBeenCalledWith('seva_prepare_day_close', { p_counter_id: 1, p_business_date: '2026-10-18' });
    expect(body.siteUrl).toBe('https://matha.example');
  });
});

// =====================================================================================================================
describe('GET /api/seva/me', () => {
  it('me marks an invited staff member active once', async () => {
    mockTables.staff[0].status = 'invited';
    const req = request('me');
    const res = await meGet(req);
    expect(res.status).toBe(200);
    expect(mockRequire).toHaveBeenCalledWith(req, 'me', { device: 'optional' });
    expect(mockCallRpc).toHaveBeenCalledTimes(1);
    expect(mockCallRpc).toHaveBeenCalledWith('seva_mark_signed_in', { p_staff_id: RAMESH.staffId });

    mockTables.staff[0].status = 'active';
    mockCallRpc.mockClear();
    await meGet(request('me'));
    expect(mockCallRpc).not.toHaveBeenCalled();
  });

  it('me answers the role, the allowed actions and the counter of a live device', async () => {
    const body = await json(await meGet(request('me')));
    expect(body).toMatchObject({
      staffId: RAMESH.staffId,
      staffNo: 23,
      name: 'Ramesh',
      role: 'receptionist',
      viewOnly: false,
      counter: { id: 1, name: 'Counter 1', onlineSeries: 'C1', offlineSeries: 'OF1' },
    });
    expect([...(body.actions as string[])].sort()).toEqual(
      [
        'counter.change_amount',
        'counter.heartbeat',
        'counter.issue',
        'dayclose.close',
        'devotees.search',
        'me',
        'receipt.cancel_own',
        'receipt.reprint',
        'receipts.list',
        'sevas.read',
      ].sort(),
    );

    mockTables.staff.push({ id: 'staff-admin', staff_no: 1, firebase_uid: 'uid-admin', status: 'active' });
    mockRequire.mockResolvedValue(allow(ADMIN, null));
    const admin = await json(await meGet(request('me')));
    expect(admin.counter).toBeNull();
    expect(admin.actions).toEqual(expect.arrayContaining(['device.register', 'receipt.cancel_any', 'staff.onboard']));
    expect(admin.actions).not.toContain('staff.delete');
  });
});

// =====================================================================================================================
describe('POST /api/seva/counter/sync', () => {
  function seedReceipts(): void {
    mockTables.seva_receipts = [
      { id: id(901), client_receipt_id: id(801), status: 'issued', seva_orders: { counter_id: 1 } },
      { id: id(902), client_receipt_id: id(802), status: 'issued', seva_orders: { counter_id: 1 } },
      { id: id(903), client_receipt_id: id(803), status: 'cancelled', seva_orders: { counter_id: 1 } },
      { id: id(904), client_receipt_id: id(804), status: 'issued', seva_orders: { counter_id: 2 } },
    ];
  }

  function cancelAnswer(ids: string[], inClosedDay = false): Row {
    return {
      receipts: ids.map((rid) => ({ id: rid, receipt_no: 'x', status: 'cancelled', refund_state: 'done', in_closed_day: inClosedDay })),
      cash_back: '105.00',
    };
  }

  it('sync stores orders and cancels in order and reports each item', async () => {
    seedReceipts();
    mockCallRpc.mockImplementation(async (fn: string, args: Row) => {
      if (fn === 'seva_sync_offline_order') {
        const order = args.p_order as Row;
        if (order.client_order_id === id(702)) throw new SevaError('number_conflict', { receipt_no: 'x' });
        return sqlOrder({ orderId: id(510), duplicate: order.client_order_id === id(703) });
      }
      if (fn === 'seva_cancel_receipts') return cancelAnswer(args.p_receipt_ids as string[]);
      throw new Error(`unexpected ${fn}`);
    });
    const items: OutboxItem[] = [
      cancelItem(4, [id(801), id(802)]),
      { seq: 2, kind: 'order', payload: offlineOrder(2) },
      { seq: 1, kind: 'order', payload: offlineOrder(1) },
      { seq: 3, kind: 'order', payload: offlineOrder(3) },
      cancelItem(5, [id(803)]),
    ];
    const req = request('counter/sync', { body: { items } });
    const res = await syncPost(req);

    expect(res.status).toBe(200);
    // The one route a retired PC may reach (DB 8.4); SQL limits what it may send.
    expect(mockRequire).toHaveBeenCalledWith(req, 'counter.issue', { device: 'required', retiredDevice: 'allow' });
    expect(await json(res)).toEqual({
      results: [
        { seq: 1, ok: true, duplicate: false },
        { seq: 2, ok: false, code: 'number_conflict' },
        { seq: 3, ok: true, duplicate: true },
        { seq: 4, ok: true },
        // Everything it names was already cancelled: nothing left to do.
        { seq: 5, ok: true, duplicate: true },
      ],
    });
    expect(mockCallRpc.mock.calls.map(([fn, args]) => [fn, (args as Row).p_order ? ((args as Row).p_order as Row).client_order_id : (args as Row).p_receipt_ids])).toEqual([
      ['seva_sync_offline_order', id(701)],
      ['seva_sync_offline_order', id(702)],
      ['seva_sync_offline_order', id(703)],
      ['seva_cancel_receipts', [id(901), id(902)]],
    ]);
    expect(mockCallRpc.mock.calls[0][1]).toEqual({
      p_order: expect.objectContaining({ issuer_staff_no: 23, group_no: 'G-2610-OF1-001', issued_at: '2026-10-18T05:00:00.000Z' }),
      p_staff_id: RAMESH.staffId,
      p_device_id: DEVICE.id,
      p_issuer_role: 'receptionist',
    });
    expect(mockCallRpc.mock.calls[3][1]).toEqual({
      p_receipt_ids: [id(901), id(902)],
      p_reason_code: 'wrong_seva',
      p_note: null,
      p_staff_id: RAMESH.staffId,
      p_is_admin: false,
      p_at: '2026-10-18T05:05:00.000Z',
      p_cancelled_by_staff_no: 23,
      p_canceller_role: 'receptionist',
    });
  });

  it("sync passes the issuer's and the canceller's role, not the syncer's", async () => {
    seedReceipts();
    // Suresh (receptionist) syncs; the outbox names others.
    mockRequire.mockResolvedValue(allow(SURESH));
    mockTables.staff.push(
      { id: 'staff-admin', staff_no: 1, firebase_uid: 'uid-admin', status: 'active' },
      { id: 'staff-drift', staff_no: 30, firebase_uid: 'uid-drift', status: 'active' },
      { id: 'staff-gone', staff_no: 31, firebase_uid: 'uid-gone', status: 'inactive' },
      { id: 'staff-nodoc', staff_no: 32, firebase_uid: 'uid-nodoc', status: 'active' },
      { id: 'staff-billing', staff_no: 33, firebase_uid: 'uid-billing', status: 'active' },
    );
    mockProfiles['uid-admin'] = { role: 'admin', isActive: true };
    // Firestore says inactive while the staff row is still active: the stores disagree, so no role (drift only denies).
    mockProfiles['uid-drift'] = { role: 'receptionist', isActive: false };
    // Offboarded after the work: both stores say inactive, the role they had is kept for the SQL check and audit.
    mockProfiles['uid-gone'] = { role: 'receptionist', isActive: false };
    mockProfiles['uid-billing'] = { role: 'billing', isActive: true };
    mockCallRpc.mockImplementation(async (fn: string, args: Row) =>
      fn === 'seva_cancel_receipts' ? cancelAnswer(args.p_receipt_ids as string[]) : sqlOrder(),
    );

    const items: OutboxItem[] = [
      { seq: 1, kind: 'order', payload: offlineOrder(1, 1) },
      { seq: 2, kind: 'order', payload: offlineOrder(2, 30) },
      { seq: 3, kind: 'order', payload: offlineOrder(3, 31) },
      { seq: 4, kind: 'order', payload: offlineOrder(4, 32) },
      { seq: 5, kind: 'order', payload: offlineOrder(5, 33) },
      { seq: 6, kind: 'order', payload: offlineOrder(6, 99) },
      cancelItem(7, [id(801)], 23),
      cancelItem(8, [id(802)], 30),
    ];
    const res = await syncPost(request('counter/sync', { body: { items } }));
    expect(res.status).toBe(200);

    const roles = mockCallRpc.mock.calls.map(([fn, args]) =>
      fn === 'seva_sync_offline_order'
        ? ['order', ((args as Row).p_order as Row).issuer_staff_no, (args as Row).p_issuer_role, (args as Row).p_staff_id]
        : ['cancel', (args as Row).p_cancelled_by_staff_no, (args as Row).p_canceller_role, (args as Row).p_staff_id],
    );
    expect(roles).toEqual([
      ['order', 1, 'temple_admin', SURESH.staffId],
      ['order', 30, null, SURESH.staffId],
      ['order', 31, 'receptionist', SURESH.staffId],
      ['order', 32, null, SURESH.staffId],
      ['order', 33, null, SURESH.staffId],
      // An unknown staff no. is passed through; the SQL function refuses it.
      ['order', 99, null, SURESH.staffId],
      ['cancel', 23, 'receptionist', SURESH.staffId],
      ['cancel', 30, null, SURESH.staffId],
    ]);
    // The syncer's own profile is never read for the role of someone else's work.
    expect(mockGetAccessProfile).not.toHaveBeenCalledWith('uid-suresh');
  });

  it("sync accepts an offline cancel only for receipts of the syncing device's counter", async () => {
    seedReceipts();
    mockCallRpc.mockImplementation(async (_fn: string, args: Row) => cancelAnswer(args.p_receipt_ids as string[]));
    const items: OutboxItem[] = [cancelItem(1, [id(801), id(804)]), cancelItem(2, [id(801), id(899)])];
    const res = await syncPost(request('counter/sync', { body: { items } }));
    expect(await json(res)).toEqual({
      results: [
        { seq: 1, ok: false, code: 'forbidden' },
        { seq: 2, ok: false, code: 'not_found' },
      ],
    });
    expect(mockCallRpc).not.toHaveBeenCalled();
  });

  it('sync flags an offline cancel recorded in an already-closed day', async () => {
    seedReceipts();
    mockCallRpc.mockImplementation(async (_fn: string, args: Row) => cancelAnswer(args.p_receipt_ids as string[], true));
    const res = await syncPost(request('counter/sync', { body: { items: [cancelItem(1, [id(801)])] } }));
    expect(await json(res)).toEqual({ results: [{ seq: 1, ok: true, inClosedDay: true }] });
  });

  it('sync stops with 503 on a non-business error', async () => {
    for (const failure of [new SevaError('internal'), new Error('socket hang up')]) {
      mockCallRpc.mockReset();
      mockCallRpc.mockImplementation(async (_fn: string, args: Row) => {
        if ((args.p_order as Row).client_order_id === id(702)) throw failure;
        return sqlOrder();
      });
      const items: OutboxItem[] = [1, 2, 3].map((n) => ({ seq: n, kind: 'order', payload: offlineOrder(n) }));
      const res = await syncPost(request('counter/sync', { body: { items } }));
      expect(res.status).toBe(503);
      const body = await json(res);
      expect(body.error).toMatchObject({ code: 'internal' });
      expect(body.results).toEqual([{ seq: 1, ok: true, duplicate: false }]);
      expect(mockCallRpc).toHaveBeenCalledTimes(2);
    }
  });

  it('sync stops with 503 when a role cannot be read', async () => {
    mockGetAccessProfile.mockRejectedValueOnce(new Error('firestore unavailable'));
    const res = await syncPost(request('counter/sync', { body: { items: [{ seq: 1, kind: 'order', payload: offlineOrder(1) }] } }));
    expect(res.status).toBe(503);
    expect(mockCallRpc).not.toHaveBeenCalled();
  });

  it('sync answers 400 validation for a bad outbox', async () => {
    const res = await syncPost(request('counter/sync', { body: { items: [{ seq: 1, kind: 'cancel', clientReceiptIds: [] }] } }));
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: { code: 'validation' } });
  });

  it("takes a retired PC's late outbox: orders inside its gap are stored, the rest refused (A3 security gate L-4)", async () => {
    seedReceipts();
    const retired = { ...DEVICE, retired: true as const };
    mockRequire.mockResolvedValue({ ok: true, actor: RAMESH, device: retired });
    // seva_sync_offline_order with the retired PC accepts numbers inside its device_replaced gap only (DB 8.4).
    mockCallRpc.mockImplementation(async (fn: string, args: Row) => {
      if (fn !== 'seva_sync_offline_order') throw new Error(`unexpected ${fn}`);
      if ((args.p_order as Row).client_order_id === id(702)) throw new SevaError('device_unknown', { receipt_no: 'x' });
      return sqlOrder();
    });
    const items: OutboxItem[] = [
      { seq: 1, kind: 'order', payload: offlineOrder(1) },
      { seq: 2, kind: 'order', payload: offlineOrder(2) },
      // Offline cancels from a retired PC are not taken: SQL cannot hold them to the gap.
      cancelItem(3, [id(801)]),
    ];
    const res = await syncPost(request('counter/sync', { body: { items } }));
    expect(await json(res)).toEqual({
      results: [
        { seq: 1, ok: true, duplicate: false },
        { seq: 2, ok: false, code: 'device_unknown' },
        { seq: 3, ok: false, code: 'device_unknown' },
      ],
    });
    expect(mockCallRpc.mock.calls.map(([fn, args]) => [fn, (args as Row).p_device_id])).toEqual([
      ['seva_sync_offline_order', DEVICE.id],
      ['seva_sync_offline_order', DEVICE.id],
    ]);
  });

  it('no other counter route lets a retired PC through (A3 security gate L-4)', async () => {
    mockRequire.mockResolvedValue(denyWith('device_required'));
    await bootstrapGet(request('counter/bootstrap'));
    await ordersPost(request('counter/orders', { body: bookOrder() }));
    await printsPost(request('counter/prints', { body: { receiptIds: [id(901)] } }));
    await heartbeatPost(request('counter/heartbeat', { body: { outboxCount: 0, clockSkewMs: 0, appVersion: '1' } }));
    await meGet(request('me'));
    expect(mockRequire.mock.calls.length).toBeGreaterThanOrEqual(5);
    for (const [, , opts] of mockRequire.mock.calls) {
      expect((opts as { retiredDevice?: string } | undefined)?.retiredDevice).toBeUndefined();
    }
  });
});

// =====================================================================================================================
describe('POST /api/seva/counter/prints', () => {
  function seedPrinted(): void {
    mockTables.seva_receipts = [
      { id: id(600), print_count: 0, business_date: '2026-10-18', seva_orders: { counter_id: 1 } },
      { id: id(601), print_count: 1, business_date: '2026-10-18', seva_orders: { counter_id: 1 } },
    ];
    mockCallRpc.mockImplementation(async (_fn: string, args: Row) => ({
      receipts: (args.p_receipt_ids as string[]).map((rid) => ({
        id: rid,
        receipt_no: 'x',
        print_count: rid === id(601) ? 2 : 1,
        duplicate: rid === id(601),
        last_printed_at: NOW.toISOString(),
      })),
    }));
  }

  it('a first print needs counter.issue only', async () => {
    seedPrinted();
    const req = request('counter/prints', { body: { receiptIds: [id(600)] } });
    const res = await printsPost(req);
    expect(res.status).toBe(200);
    expect(mockRequire).toHaveBeenCalledTimes(1);
    expect(mockRequire).toHaveBeenCalledWith(req, 'counter.issue', { device: 'required' });
    expect(mockCallRpc).toHaveBeenCalledWith('seva_record_prints', {
      p_receipt_ids: [id(600)],
      p_staff_id: RAMESH.staffId,
      p_device_id: DEVICE.id,
    });
    expect(await json(res)).toEqual({ receipts: [{ id: id(600), printCount: 1, duplicate: false }] });
  });

  it('a reprint needs receipt.reprint with the own-counter context', async () => {
    seedPrinted();
    const req = request('counter/prints', { body: { receiptIds: [id(600), id(601)] } });
    const res = await printsPost(req);
    expect(res.status).toBe(200);
    expect(mockRequire).toHaveBeenNthCalledWith(2, req, 'receipt.reprint', {
      device: 'required',
      ctx: { counterIdOfDevice: 1, receiptCounterId: 1, receiptBusinessDate: '2026-10-18' },
    });
    expect(await json(res)).toEqual({
      receipts: [
        { id: id(600), printCount: 1, duplicate: false },
        { id: id(601), printCount: 2, duplicate: true },
      ],
    });

    // Refused by the guard (another counter or an earlier day for a receptionist): nothing is printed.
    mockCallRpc.mockClear();
    mockRequire.mockResolvedValueOnce(allow()).mockResolvedValueOnce(denyWith('forbidden'));
    const denied = await printsPost(request('counter/prints', { body: { receiptIds: [id(601)] } }));
    expect(denied.status).toBe(403);
    expect(mockCallRpc).not.toHaveBeenCalled();
  });
});

// =====================================================================================================================
describe('POST /api/seva/counter/heartbeat', () => {
  it('heartbeat returns the server time, the OF floor and the group label floor', async () => {
    mockCallRpc.mockResolvedValue({
      server_time: '2026-10-18T10:42:00.5+05:30',
      of_series: 'OF1',
      last_of_no: 7,
      last_of_group_no: 3,
      day_closed: false,
    });
    const req = request('counter/heartbeat', { body: { outboxCount: 2, clockSkewMs: -1500, appVersion: 'seva-counter-1' } });
    const res = await heartbeatPost(req);
    expect(res.status).toBe(200);
    expect(mockRequire).toHaveBeenCalledWith(req, 'counter.heartbeat', { device: 'required' });
    expect(mockCallRpc).toHaveBeenCalledWith('seva_heartbeat', {
      p_device_id: DEVICE.id,
      p_outbox_count: 2,
      p_clock_skew_ms: -1500,
      p_app_version: 'seva-counter-1',
    });
    expect(await json(res)).toEqual({
      serverTime: '2026-10-18T05:12:00.500Z',
      ofSeries: 'OF1',
      lastOfNo: 7,
      lastOfGroupNo: 3,
      dayClosed: false,
    });
  });

  it('heartbeat refuses a bad body', async () => {
    const res = await heartbeatPost(request('counter/heartbeat', { body: { outboxCount: -1, clockSkewMs: 0, appVersion: 'v' } }));
    expect(res.status).toBe(400);
    expect(mockCallRpc).not.toHaveBeenCalled();
  });
});

// =====================================================================================================================
describe('POST /api/seva/counter/devices', () => {
  const HASH = 'a'.repeat(64);

  it('only temple admins and super admins register devices', async () => {
    mockRequire.mockResolvedValue(allow(ADMIN, null));
    mockCallRpc.mockResolvedValue(DEVICE.id);
    const req = request('counter/devices', { body: { action: 'register', counterId: 1, secretHash: HASH, label: 'Office PC' } });
    const res = await devicesPost(req);
    expect(res.status).toBe(200);
    expect(mockRequire).toHaveBeenCalledWith(req, 'device.register');
    expect(mockCallRpc).toHaveBeenCalledWith('seva_register_device', {
      p_counter_id: 1,
      p_secret_hash: HASH,
      p_label: 'Office PC',
      p_staff_id: ADMIN.staffId,
    });
    expect(await json(res)).toEqual({ deviceId: DEVICE.id });

    mockCallRpc.mockClear();
    mockRequire.mockResolvedValue(denyWith('forbidden'));
    const denied = await devicesPost(request('counter/devices', { body: { action: 'register', counterId: 1, secretHash: HASH, label: '' } }));
    expect(denied.status).toBe(403);
    expect(mockCallRpc).not.toHaveBeenCalled();
  });

  it('replace passes the last printed OF number and the reason', async () => {
    mockRequire.mockResolvedValue(allow(ADMIN, null));
    mockCallRpc.mockResolvedValue(DEVICE.id);
    const res = await devicesPost(
      request('counter/devices', {
        body: { action: 'replace', counterId: 1, secretHash: HASH, label: 'New PC', lastPrintedOfNo: 12, reason: 'Old PC died' },
      }),
    );
    expect(res.status).toBe(200);
    expect(mockCallRpc).toHaveBeenCalledWith('seva_replace_device', {
      p_counter_id: 1,
      p_secret_hash: HASH,
      p_label: 'New PC',
      p_last_printed_of_no: 12,
      p_reason: 'Old PC died',
      p_staff_id: ADMIN.staffId,
    });
    expect(await json(res)).toEqual({ deviceId: DEVICE.id });
  });
});

// =====================================================================================================================
describe('browser clients', () => {
  it('call the counter routes with the token and the device header', async () => {
    const calls: { url: string; method: string; headers: Record<string, string>; body: unknown }[] = [];
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        headers: init?.headers as Record<string, string>,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    try {
      const api = counterApi(async () => 'token-1', () => 'device.secret');
      await api.bootstrap();
      await api.issue(bookOrder());
      await api.sync([{ seq: 1, kind: 'order', payload: offlineOrder(1) }]);
      await api.prints([id(600)]);
      await api.heartbeat({ outboxCount: 0, clockSkewMs: 0, appVersion: 'v' });
      await api.registerDevice({ counterId: 1, secretHash: 'a'.repeat(64), label: 'PC' });
      await api.replaceDevice({ counterId: 1, secretHash: 'a'.repeat(64), label: 'PC', lastPrintedOfNo: 3, reason: 'Died' });
      await meApi(async () => 'token-2', () => null).get();
    } finally {
      fetchSpy.mockRestore();
    }
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['GET', '/api/seva/counter/bootstrap'],
      ['POST', '/api/seva/counter/orders'],
      ['POST', '/api/seva/counter/sync'],
      ['POST', '/api/seva/counter/prints'],
      ['POST', '/api/seva/counter/heartbeat'],
      ['POST', '/api/seva/counter/devices'],
      ['POST', '/api/seva/counter/devices'],
      ['GET', '/api/seva/me'],
    ]);
    expect(calls[0].headers).toMatchObject({ Authorization: 'Bearer token-1', 'x-seva-device': 'device.secret' });
    expect(calls[2].body).toEqual({ items: [{ seq: 1, kind: 'order', payload: offlineOrder(1) }] });
    expect(calls[3].body).toEqual({ receiptIds: [id(600)] });
    expect(calls[5].body).toEqual({ action: 'register', counterId: 1, secretHash: 'a'.repeat(64), label: 'PC' });
    expect(calls[6].body).toMatchObject({ action: 'replace', lastPrintedOfNo: 3, reason: 'Died' });
    expect(calls[7].headers).toMatchObject({ Authorization: 'Bearer token-2' });
    expect(calls[7].headers['x-seva-device']).toBeUndefined();
  });
});
