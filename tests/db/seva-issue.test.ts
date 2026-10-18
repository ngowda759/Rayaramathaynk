/**
 * Database tests for Task A2-1 (part 1 of 3): issuing a counter order with seva_issue_counter_order, the receipt and
 * group numbers behind it (seva_take_numbers, seva_next_group_no), and the devotee profile it keeps.
 *
 * Every test starts from its own copy of one migrated template database (a PGlite data-dir clone), so receipt
 * numbers start at 000001 in every test. The seed helpers only set the starting state; every rule is proved through
 * the SQL functions, called as service_role exactly as the API routes will call them.
 */
import { randomBytes, randomUUID } from 'crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { applyMigrationFile, asRole, freshDb } from './harness';
import { seedDevice, seedSeva, seedStaff } from './fixtures';

interface Ctx {
  db: PGlite;
  staffId: string;
  deviceId: string;
  pan: string;
  paa: string;
  kar: string;
  today: string;
  month: string;
  year: string;
}

interface SqlLine {
  line_no: number;
  seva_id: string;
  code: string | null;
  name_en: string;
  quantity: number;
  catalogue_rate: string | null;
  unit_rate: string;
  amount: string;
  changed: boolean;
  change_reason: string | null;
}

interface SqlReceipt {
  id: string;
  client_receipt_id: string;
  receipt_no: string;
  series_code: string;
  seva_date: string;
  business_date: string;
  group_no: string;
  position: number;
  count: number;
  order_total: string;
  total: string;
  lines: SqlLine[];
  payment: { mode: string; upi_ref_last6: string | null; cash_received: string | null; change_returned: string | null };
  devotee: { name: string; gotra: string | null; nakshatra_id: number | null };
  qr_token: string;
  issued_at: string;
  issued_by: { name: string; staff_no: number | null };
  counter_name: string | null;
  channel: string;
  issued_offline: boolean;
  status: string;
  print_count: number;
  prasadam: string;
  has_changed_amount: boolean;
}

interface IssueResult {
  order_id: string;
  group_no: string;
  duplicate: boolean;
  receipts: SqlReceipt[];
}

interface LineSpec {
  sevaId: string;
  quantity?: number;
  unitRate?: string | null;
  changeReason?: string | null;
}

interface OrderSpec {
  receipts: { date: string; lines: LineSpec[] }[];
  expectedTotal: string;
  payment?: Record<string, unknown>;
  devotee?: Record<string, unknown>;
  clientOrderId?: string;
}

interface SevaFailure {
  code: string;
  detail: Record<string, unknown> | null;
}

let template: Blob;
let ctx: Ctx | null = null;

beforeAll(async () => {
  const db = await freshDb();
  template = await db.dumpDataDir('none');
  await db.close();
}, 120_000);

afterEach(async () => {
  if (ctx) {
    await ctx.db.close();
    ctx = null;
  }
});

/** A copy of the template with staff 023 Ramesh, a live PC on Counter 1 and the PAN / PAA / KAR sevas. */
async function setup(): Promise<Ctx> {
  const db = await PGlite.create({ loadDataDir: template, extensions: { uuid_ossp, pgcrypto } });
  const staffId = await seedStaff(db, { staffNo: 23, name: 'Ramesh', uid: 'uid-ramesh' });
  const deviceId = await seedDevice(db, { staffId });
  const pan = await seedSeva(db, {
    code: 'PAN',
    nameEn: 'Panchamrutha Abhisheka',
    amount: '105.00',
    key: 1,
    multiDate: true,
    prasadamGiven: true,
  });
  const paa = await seedSeva(db, { code: 'PAA', nameEn: 'Paaduka Pooja', amount: '505.00', key: 2 });
  const kar = await seedSeva(db, { code: 'KAR', nameEn: 'Other Seva / Karnike', amount: null, key: 3 });
  const parts = await db.query<{ d: string; m: string; y: string }>(
    `select p.business_date::text as d, lpad(p.month::text, 2, '0') as m, p.year::text as y
       from seva_ist_parts(now()) p`,
  );
  ctx = { db, staffId, deviceId, pan, paa, kar, today: parts.rows[0].d, month: parts.rows[0].m, year: parts.rows[0].y };
  return ctx;
}

function addDays(date: string, days: number): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

function qrToken(): string {
  return randomBytes(16).toString('base64url');
}

function buildOrder(p: OrderSpec): Record<string, unknown> {
  return {
    client_order_id: p.clientOrderId ?? randomUUID(),
    expected_total: p.expectedTotal,
    devotee: {
      name: 'Venkatesh Rao',
      gotra: 'Bharadwaja',
      gotra_id: 7,
      nakshatra_id: 4,
      nakshatra_text: null,
      rashi_id: null,
      rashi_text: null,
      phone_e164: null,
      ...p.devotee,
    },
    payment: p.payment ?? { mode: 'cash', cash_received: null, upi_ref_last6: null, upi_seen_confirmed: null },
    receipts: p.receipts.map((r) => ({
      client_receipt_id: randomUUID(),
      seva_date: r.date,
      qr_token: qrToken(),
      lines: r.lines.map((l) => ({
        seva_id: l.sevaId,
        quantity: l.quantity ?? 1,
        unit_rate: l.unitRate ?? null,
        change_reason: l.changeReason ?? null,
      })),
    })),
  };
}

/** The Design Book example: PAN on three dates and PAA on the first - Rs 610 + 105 + 105 = 820. */
function bookOrder(c: Ctx, expectedTotal: string, extra: Partial<OrderSpec> = {}): Record<string, unknown> {
  return buildOrder({
    expectedTotal,
    receipts: [
      { date: addDays(c.today, 12), lines: [{ sevaId: c.pan }] },
      { date: addDays(c.today, 10), lines: [{ sevaId: c.pan }, { sevaId: c.paa }] },
      { date: addDays(c.today, 11), lines: [{ sevaId: c.pan }] },
    ],
    ...extra,
  });
}

function oneLine(c: Ctx, line: LineSpec, expectedTotal: string, extra: Partial<OrderSpec> = {}): Record<string, unknown> {
  return buildOrder({ expectedTotal, receipts: [{ date: c.today, lines: [line] }], ...extra });
}

async function issue(
  c: Ctx,
  order: Record<string, unknown>,
  staffId: string = c.staffId,
  deviceId: string = c.deviceId,
): Promise<IssueResult> {
  return asRole(c.db, 'service_role', async (d) => {
    const r = await d.query<{ r: IssueResult }>('select seva_issue_counter_order($1::jsonb, $2::uuid, $3::uuid) as r', [
      JSON.stringify(order),
      staffId,
      deviceId,
    ]);
    return r.rows[0].r;
  });
}

async function failure(p: Promise<unknown>): Promise<SevaFailure> {
  try {
    await p;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const raw = typeof error === 'object' && error !== null ? (error as { detail?: unknown }).detail : undefined;
    const match = /^SEVA:([a-z_]+)$/.exec(message);
    return {
      code: match ? match[1] : message,
      detail: typeof raw === 'string' && raw.length > 0 ? (JSON.parse(raw) as Record<string, unknown>) : null,
    };
  }
  throw new Error('expected the call to fail with a SEVA error');
}

async function count(db: PGlite, table: string, where = 'true'): Promise<number> {
  const r = await db.query<{ n: number }>(`select count(*)::int as n from ${table} where ${where}`);
  return r.rows[0].n;
}

async function lastNo(db: PGlite, series: string, year: number): Promise<number> {
  const r = await db.query<{ n: number }>(
    'select last_no as n from receipt_series_years where series_code = $1 and year = $2::smallint',
    [series, year],
  );
  return r.rows.length === 0 ? 0 : r.rows[0].n;
}

describe('seva_issue_counter_order (A2-1)', () => {
  it('issues one receipt per seva date with consecutive C1 numbers', async () => {
    const c = await setup();
    const d1 = addDays(c.today, 10);
    const d2 = addDays(c.today, 11);
    const d3 = addDays(c.today, 12);

    const res = await issue(c, bookOrder(c, '820.00'));

    expect(res.duplicate).toBe(false);
    expect(res.group_no).toBe(`G-${c.year.slice(2)}${c.month}-0001`);
    const prefix = `C1-023-${c.month}-${c.year}/`;
    expect(res.receipts.map((r) => [r.position, r.receipt_no, r.seva_date, r.total, r.count, r.order_total])).toEqual([
      [1, `${prefix}000001`, d1, '610.00', 3, '820.00'],
      [2, `${prefix}000002`, d2, '105.00', 3, '820.00'],
      [3, `${prefix}000003`, d3, '105.00', 3, '820.00'],
    ]);
    expect(res.receipts[0]).toMatchObject({
      series_code: 'C1',
      group_no: res.group_no,
      business_date: c.today,
      status: 'issued',
      print_count: 0,
      issued_offline: false,
      channel: 'counter',
      counter_name: 'Counter 1',
      issued_by: { name: 'Ramesh', staff_no: 23 },
      prasadam: 'pending',
      has_changed_amount: false,
      payment: { mode: 'cash' },
      devotee: { name: 'Venkatesh Rao', gotra: 'Bharadwaja', nakshatra_id: 4 },
    });
    expect(res.receipts[0].lines.map((l) => [l.line_no, l.code, l.name_en, l.quantity, l.unit_rate, l.amount, l.changed])).toEqual([
      [1, 'PAN', 'Panchamrutha Abhisheka', 1, '105.00', '105.00', false],
      [2, 'PAA', 'Paaduka Pooja', 1, '505.00', '505.00', false],
    ]);

    const order = await c.db.query(
      `select amount_total::text as total, receipts_count, issued_offline, counter_id, device_id, issued_by_staff_id
         from seva_orders`,
    );
    expect(order.rows).toEqual([
      { total: '820.00', receipts_count: 3, issued_offline: false, counter_id: 1, device_id: c.deviceId, issued_by_staff_id: c.staffId },
    ]);
    expect(await lastNo(c.db, 'C1', Number(c.year))).toBe(3);
    // A normal issue writes no audit row (C-36).
    expect(await count(c.db, 'audit_log')).toBe(0);
  });

  it('prices lines from the catalogue when unit_rate is null', async () => {
    const c = await setup();
    const res = await issue(c, oneLine(c, { sevaId: c.pan, quantity: 2 }, '210.00'));

    expect(res.receipts[0].lines[0]).toMatchObject({ catalogue_rate: '105.00', unit_rate: '105.00', amount: '210.00', changed: false });
    const line = await c.db.query(
      `select catalogue_rate::text as catalogue_rate, unit_rate::text as unit_rate, amount::text as amount,
              amount_changed, change_reason
         from seva_receipt_lines`,
    );
    expect(line.rows).toEqual([
      { catalogue_rate: '105.00', unit_rate: '105.00', amount: '210.00', amount_changed: false, change_reason: null },
    ]);
  });

  it('repeated client_order_id returns the same receipts', async () => {
    const c = await setup();
    const order = bookOrder(c, '820.00');
    const first = await issue(c, order);
    const second = await issue(c, order);

    expect(second.duplicate).toBe(true);
    expect(second.order_id).toBe(first.order_id);
    expect(second.receipts.map((r) => r.id)).toEqual(first.receipts.map((r) => r.id));
    expect(second.receipts.map((r) => r.receipt_no)).toEqual(first.receipts.map((r) => r.receipt_no));
    expect(await count(c.db, 'seva_orders')).toBe(1);
    expect(await lastNo(c.db, 'C1', Number(c.year))).toBe(3);
  });

  it('rejects an order whose expected total no longer matches the catalogue', async () => {
    const c = await setup();
    const f = await failure(issue(c, bookOrder(c, '800.00')));

    expect(f.code).toBe('price_changed');
    const lines = (f.detail?.lines ?? []) as unknown[];
    expect(lines).toHaveLength(2);
    expect(lines).toEqual(
      expect.arrayContaining([
        { seva_id: c.pan, rate: '105.00' },
        { seva_id: c.paa, rate: '505.00' },
      ]),
    );
    expect(await count(c.db, 'seva_orders')).toBe(0);
    expect(await count(c.db, 'seva_receipts')).toBe(0);
    expect(await lastNo(c.db, 'C1', Number(c.year))).toBe(0);
  });

  it('rejects a switched-off seva and a seva not shown on the counter', async () => {
    const c = await setup();
    await c.db.query('update sevas set active = false where id = $1', [c.paa]);
    expect(await failure(issue(c, bookOrder(c, '820.00')))).toEqual({
      code: 'seva_inactive',
      detail: { name: 'Paaduka Pooja' },
    });

    const onl = await seedSeva(c.db, { code: 'ONL', nameEn: 'Online Archana', amount: '51.00', visibility: 'online' });
    expect(await failure(issue(c, oneLine(c, { sevaId: onl }, '51.00')))).toEqual({
      code: 'seva_not_on_counter',
      detail: { name: 'Online Archana' },
    });
    expect(await count(c.db, 'seva_orders')).toBe(0);
  });

  it('allows a changed amount only where permitted and with a reason', async () => {
    const c = await setup();
    const fix = await seedSeva(c.db, { code: 'FIX', nameEn: 'Fixed Seva', amount: '250.00', allowAmountChange: false });

    expect(
      await failure(issue(c, oneLine(c, { sevaId: fix, unitRate: '300.00', changeReason: 'Devotee offered more' }, '300.00'))),
    ).toEqual({ code: 'amount_change_not_allowed', detail: { name: 'Fixed Seva' } });
    expect((await failure(issue(c, oneLine(c, { sevaId: c.pan, unitRate: '150.00' }, '150.00')))).code).toBe(
      'change_reason_required',
    );
    expect(
      (await failure(issue(c, oneLine(c, { sevaId: c.pan, unitRate: '150.00', changeReason: ' ab ' }, '150.00')))).code,
    ).toBe('change_reason_required');
    expect(await count(c.db, 'seva_orders')).toBe(0);

    const res = await issue(
      c,
      oneLine(c, { sevaId: c.pan, quantity: 2, unitRate: '150.00', changeReason: 'Devotee offered more' }, '300.00'),
    );
    const receipt = res.receipts[0];
    expect(receipt.has_changed_amount).toBe(true);
    expect(receipt.lines[0]).toMatchObject({
      catalogue_rate: '105.00',
      unit_rate: '150.00',
      amount: '300.00',
      changed: true,
      change_reason: 'Devotee offered more',
    });
    const audit = await c.db.query(
      `select action, entity, entity_id, receipt_no, reason, actor_staff_id from audit_log order by id`,
    );
    expect(audit.rows).toEqual([
      {
        action: 'receipt.amount_changed',
        entity: 'receipt',
        entity_id: receipt.id,
        receipt_no: receipt.receipt_no,
        reason: 'Devotee offered more',
        actor_staff_id: c.staffId,
      },
    ]);

    // Sending the catalogue rate itself is not a change, so it needs no reason.
    const same = await issue(c, oneLine(c, { sevaId: c.pan, unitRate: '105.00' }, '105.00'));
    expect(same.receipts[0].has_changed_amount).toBe(false);
    expect(same.receipts[0].lines[0]).toMatchObject({ changed: false, change_reason: null });
    expect(await count(c.db, 'audit_log')).toBe(1);
  });

  it('takes any amount for Other Seva without marking it changed', async () => {
    const c = await setup();
    // An any-amount seva is stored as amount 0.00 with any_amount = true: the flag says so, never a null amount.
    const stored = await c.db.query('select amount::text as amount, any_amount from sevas where id = $1', [c.kar]);
    expect(stored.rows).toEqual([{ amount: '0.00', any_amount: true }]);

    const res = await issue(c, oneLine(c, { sevaId: c.kar, unitRate: '251.00' }, '251.00'));
    expect(res.receipts[0].has_changed_amount).toBe(false);
    expect(res.receipts[0].lines[0]).toMatchObject({ catalogue_rate: null, unit_rate: '251.00', amount: '251.00', changed: false });
    expect(await count(c.db, 'audit_log')).toBe(0);

    // Without a typed amount the 0.00 in the catalogue is never used as the price.
    expect(await failure(issue(c, oneLine(c, { sevaId: c.kar }, '0.00')))).toEqual({
      code: 'validation',
      detail: { field: 'unit_rate' },
    });
  });

  it('refuses past dates and dates beyond counter_days_ahead', async () => {
    const c = await setup();
    const at = (date: string): Record<string, unknown> =>
      buildOrder({ expectedTotal: '105.00', receipts: [{ date, lines: [{ sevaId: c.pan }] }] });

    expect((await failure(issue(c, at(addDays(c.today, -1))))).code).toBe('date_out_of_range');
    expect((await failure(issue(c, at(addDays(c.today, 366))))).code).toBe('date_out_of_range');
    await expect(issue(c, at(c.today))).resolves.toMatchObject({ duplicate: false });
    await expect(issue(c, at(addDays(c.today, 365)))).resolves.toMatchObject({ duplicate: false });

    await c.db.query('update seva_settings set counter_days_ahead = 10 where id = 1');
    const f = await failure(issue(c, at(addDays(c.today, 11))));
    expect(f.code).toBe('date_out_of_range');
    expect(f.detail).toMatchObject({ seva_date: addDays(c.today, 11) });
    await expect(issue(c, at(addDays(c.today, 10)))).resolves.toMatchObject({ duplicate: false });
  });

  it('checks cash received and stores the change', async () => {
    const c = await setup();
    const paid = await issue(c, bookOrder(c, '820.00', { payment: { mode: 'cash', cash_received: '1000.00' } }));
    expect(paid.receipts[0].payment).toMatchObject({ mode: 'cash', cash_received: '1000.00', change_returned: '180.00' });
    const order = await c.db.query(
      'select cash_received::text as received, change_returned::text as change from seva_orders where id = $1',
      [paid.order_id],
    );
    expect(order.rows).toEqual([{ received: '1000.00', change: '180.00' }]);

    expect((await failure(issue(c, bookOrder(c, '820.00', { payment: { mode: 'cash', cash_received: '800.00' } })))).code).toBe(
      'cash_short',
    );
    const exact = await issue(c, bookOrder(c, '820.00', { payment: { mode: 'cash', cash_received: '820.00' } }));
    expect(exact.receipts[0].payment).toMatchObject({ cash_received: '820.00', change_returned: '0.00' });
    expect(await count(c.db, 'seva_orders')).toBe(2);
  });

  it('needs six UPI digits and the confirmation', async () => {
    const c = await setup();
    const upi = (ref: unknown, seen: unknown): Record<string, unknown> =>
      oneLine(c, { sevaId: c.pan }, '105.00', { payment: { mode: 'upi', upi_ref_last6: ref, upi_seen_confirmed: seen } });

    for (const [ref, seen] of [
      ['12345', true],
      ['1234567', true],
      ['abcdef', true],
      [null, true],
      ['119042', false],
      ['119042', null],
    ] as const) {
      expect({ ref, seen, code: (await failure(issue(c, upi(ref, seen)))).code }).toEqual({
        ref,
        seen,
        code: 'upi_details_required',
      });
    }

    const res = await issue(c, upi('119042', true));
    expect(res.receipts[0].payment).toMatchObject({ mode: 'upi', upi_ref_last6: '119042', cash_received: null });
    const order = await c.db.query('select payment_mode, upi_ref_last6, upi_seen_confirmed, cash_received from seva_orders');
    expect(order.rows).toEqual([{ payment_mode: 'upi', upi_ref_last6: '119042', upi_seen_confirmed: true, cash_received: null }]);
  });

  it('refuses a retired device, an inactive staff member and a closed day', async () => {
    const c = await setup();
    const order = (): Record<string, unknown> => oneLine(c, { sevaId: c.pan }, '105.00');

    const suresh = await seedStaff(c.db, { staffNo: 24, name: 'Suresh', uid: 'uid-suresh' });
    await c.db.query(`update staff set status = 'inactive', status_reason = 'Left the temple office' where id = $1`, [suresh]);
    expect((await failure(issue(c, order(), suresh))).code).toBe('staff_inactive');
    expect((await failure(issue(c, order(), randomUUID()))).code).toBe('staff_inactive');
    const invited = await seedStaff(c.db, { staffNo: 25, name: 'Ganesh', uid: 'uid-ganesh', status: 'invited' });
    expect((await failure(issue(c, order(), invited))).code).toBe('staff_inactive');

    await c.db.query(
      `update counter_devices set retired_at = now(), retired_by_staff_id = $2, retired_reason = 'Replaced' where id = $1`,
      [c.deviceId, c.staffId],
    );
    expect((await failure(issue(c, order()))).code).toBe('device_unknown');
    expect((await failure(issue(c, order(), c.staffId, randomUUID()))).code).toBe('device_unknown');

    const newDevice = await seedDevice(c.db, { staffId: c.staffId });
    const close = await c.db.query<{ id: string }>(
      `insert into day_closes (counter_id, business_date, status, cash_expected, cash_counted, series_ranges,
                               outbox_pending, closed_by_staff_id, closed_at)
       values (1, $1::date, 'closed', 0, 0, '[]'::jsonb, 0, $2::uuid, now())
       returning id`,
      [c.today, c.staffId],
    );
    expect((await failure(issue(c, order(), c.staffId, newDevice))).code).toBe('day_closed');
    expect(await count(c.db, 'seva_orders')).toBe(0);

    await c.db.query(
      `update day_closes set status = 'reopened', reopened_at = now(), reopened_by_staff_id = $2::uuid,
              reopen_reason = 'Late devotee'
        where id = $1`,
      [close.rows[0].id, c.staffId],
    );
    await expect(issue(c, order(), c.staffId, newDevice)).resolves.toMatchObject({ duplicate: false });
  });

  it('upserts the devotee profile only when a phone is given', async () => {
    const c = await setup();
    const phone = '+919845012345';
    const first = await issue(c, bookOrder(c, '820.00', { devotee: { phone_e164: phone } }));
    // The phone is stored on the order but never sent back (C-31).
    expect(JSON.stringify(first)).not.toContain('9845012345');
    const stored = await c.db.query('select phone_e164 from seva_orders where id = $1', [first.order_id]);
    expect(stored.rows).toEqual([{ phone_e164: phone }]);

    await issue(
      c,
      oneLine(c, { sevaId: c.pan }, '105.00', {
        devotee: { name: 'Venkatesh R', gotra: null, gotra_id: null, nakshatra_id: 5, phone_e164: phone },
      }),
    );
    const profile = await c.db.query(
      'select phone_e164, name, gotra, gotra_id, nakshatra_id, visit_count from devotee_profiles',
    );
    expect(profile.rows).toEqual([
      { phone_e164: phone, name: 'Venkatesh R', gotra: 'Bharadwaja', gotra_id: 7, nakshatra_id: 5, visit_count: 2 },
    ]);

    await issue(c, oneLine(c, { sevaId: c.pan }, '105.00', { devotee: { name: 'Lakshmi Bai', phone_e164: null } }));
    expect(await count(c.db, 'devotee_profiles')).toBe(1);

    expect(
      await failure(issue(c, oneLine(c, { sevaId: c.pan }, '105.00', { devotee: { phone_e164: '9845012345' } }))),
    ).toEqual({ code: 'validation', detail: { field: 'phone_e164' } });
  });

  it('keeps a Kannada name, trimmed, and refuses a malformed order', async () => {
    const c = await setup();
    const res = await issue(c, oneLine(c, { sevaId: c.pan }, '105.00', { devotee: { name: '  ವೆಂಕಟೇಶ ರಾವ್  ' } }));
    expect(res.receipts[0].devotee.name).toBe('ವೆಂಕಟೇಶ ರಾವ್');

    const base = (): Record<string, unknown> => oneLine(c, { sevaId: c.pan }, '105.00');
    const receiptsOf = (o: Record<string, unknown>): Record<string, unknown>[] => o.receipts as Record<string, unknown>[];
    const linesOf = (o: Record<string, unknown>): Record<string, unknown>[] =>
      receiptsOf(o)[0].lines as Record<string, unknown>[];
    const cases: [string, (o: Record<string, unknown>) => void][] = [
      ['client_order_id', (o) => { o.client_order_id = 'not-a-uuid'; }],
      ['name', (o) => { (o.devotee as Record<string, unknown>).name = '   '; }],
      ['name', (o) => { (o.devotee as Record<string, unknown>).name = 'x'.repeat(81); }],
      ['gotra', (o) => { (o.devotee as Record<string, unknown>).gotra = 'g'.repeat(61); }],
      ['nakshatra_id', (o) => { (o.devotee as Record<string, unknown>).nakshatra_id = 28; }],
      ['receipts', (o) => { o.receipts = []; }],
      ['lines', (o) => { receiptsOf(o)[0].lines = Array.from({ length: 9 }, () => ({ seva_id: c.pan, quantity: 1 })); }],
      ['quantity', (o) => { linesOf(o)[0].quantity = 0; }],
      ['quantity', (o) => { linesOf(o)[0].quantity = 100; }],
      ['unit_rate', (o) => { linesOf(o)[0].unit_rate = '-5'; }],
      ['unit_rate', (o) => { linesOf(o)[0].unit_rate = '10.555'; }],
      ['qr_token', (o) => { receiptsOf(o)[0].qr_token = 'short'; }],
      ['seva_date', (o) => { receiptsOf(o)[0].seva_date = '2026-02-30'; }],
      ['seva_date', (o) => { o.receipts = [receiptsOf(o)[0], { ...receiptsOf(o)[0], client_receipt_id: randomUUID(), qr_token: qrToken() }]; }],
      ['seva_id', (o) => { linesOf(o)[0].seva_id = randomUUID(); }],
      ['payment.mode', (o) => { o.payment = { mode: 'online' }; }],
    ];
    for (const [field, mutate] of cases) {
      const order = base();
      mutate(order);
      expect({ field, failure: await failure(issue(c, order)) }).toEqual({
        field,
        failure: { code: 'validation', detail: expect.objectContaining({ field }) },
      });
    }
    expect(await count(c.db, 'seva_orders')).toBe(1);
  });

  it('keeps numbers per series and per year', async () => {
    const c = await setup();
    const take = async (series: string, year: number, n: number): Promise<number> =>
      asRole(c.db, 'service_role', async (d) => {
        const r = await d.query<{ n: number }>('select seva_take_numbers($1, $2::smallint, $3) as n', [series, year, n]);
        return r.rows[0].n;
      });

    expect(await take('C1', 2026, 3)).toBe(1);
    expect(await take('C1', 2026, 1)).toBe(4);
    expect(await take('C1', 2027, 1)).toBe(1);
    expect(await take('OF1', 2026, 1)).toBe(1);
    expect(await take('W', 2026, 2)).toBe(1);
    expect(await lastNo(c.db, 'C1', 2026)).toBe(4);
    expect(await failure(take('C9', 2026, 1))).toEqual({ code: 'validation', detail: { field: 'series' } });
    expect(await failure(take('C1', 2026, 0))).toEqual({ code: 'validation', detail: { field: 'count' } });

    await c.db.query(`update receipt_series_years set last_no = 999998 where series_code = 'C1' and year = 2026`);
    expect(await failure(take('C1', 2026, 2))).toMatchObject({ code: 'validation', detail: { field: 'running_no' } });
    expect(await take('C1', 2026, 1)).toBe(999999);
  });

  it('gives group numbers per IST month', async () => {
    const c = await setup();
    const group = async (at: string): Promise<string> =>
      asRole(c.db, 'service_role', async (d) => {
        const r = await d.query<{ g: string }>('select seva_next_group_no($1::timestamptz) as g', [at]);
        return r.rows[0].g;
      });

    expect(await group('2026-10-18T05:00:00Z')).toBe('G-2610-0001');
    expect(await group('2026-10-31T18:29:59Z')).toBe('G-2610-0002');
    // 18:30 UTC on 31 October is 1 November in IST.
    expect(await group('2026-10-31T18:30:00Z')).toBe('G-2611-0001');
    await c.db.query(`update group_counters set last_no = 9999 where yymm = '2610'`);
    expect(await group('2026-10-20T05:00:00Z')).toBe('G-2610-10000');
  });

  it('burns no number when an order fails', async () => {
    const c = await setup();
    const good = (): Record<string, unknown> => oneLine(c, { sevaId: c.pan }, '105.00');

    const first = await issue(c, good());
    expect((await failure(issue(c, oneLine(c, { sevaId: c.pan }, '1.00')))).code).toBe('price_changed');
    expect((await failure(issue(c, oneLine(c, { sevaId: c.paa }, '505.00', { payment: { mode: 'cash', cash_received: '5.00' } })))).code).toBe(
      'cash_short',
    );
    const second = await issue(c, good());

    const prefix = `C1-023-${c.month}-${c.year}/`;
    expect([first.receipts[0].receipt_no, second.receipts[0].receipt_no]).toEqual([`${prefix}000001`, `${prefix}000002`]);
    expect(await lastNo(c.db, 'C1', Number(c.year))).toBe(2);
    expect(await count(c.db, 'receipt_number_gaps')).toBe(0);
    expect(await count(c.db, 'seva_orders')).toBe(2);
  });

  it('sets prasadam pending only when a line gives prasadam', async () => {
    const c = await setup();
    const nop = await seedSeva(c.db, { code: 'NDE', nameEn: 'Nanda Deepa', amount: '51.00', prasadamGiven: false });
    const res = await issue(
      c,
      buildOrder({
        expectedTotal: '207.00',
        receipts: [
          { date: addDays(c.today, 1), lines: [{ sevaId: nop }] },
          { date: addDays(c.today, 2), lines: [{ sevaId: nop }, { sevaId: c.pan }] },
        ],
      }),
    );
    expect(res.receipts.map((r) => [r.seva_date, r.prasadam])).toEqual([
      [addDays(c.today, 1), 'none'],
      [addDays(c.today, 2), 'pending'],
    ]);
  });

  it('lets only service_role execute the A2-1 functions', async () => {
    const c = await setup();
    const named = [
      'seva_take_numbers(text,smallint,integer)',
      'seva_next_group_no(timestamptz)',
      'seva_issue_counter_order(jsonb,uuid,uuid)',
      'seva_sync_offline_order(jsonb,uuid,uuid,text)',
      'seva_record_prints(uuid[],uuid,uuid)',
      'seva_cancel_receipts(uuid[],text,text,uuid,boolean,timestamptz)',
      'seva_reissue_spoiled(uuid,uuid,uuid,text)',
      'seva_order_json(uuid,boolean)',
    ];
    const helpers = await c.db.query<{ sig: string }>(
      `select p.oid::regprocedure::text as sig
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'seva\\_issue\\_%'
        order by 1`,
    );
    expect(helpers.rows.length).toBeGreaterThanOrEqual(15);
    for (const sig of [...named, ...helpers.rows.map((h) => h.sig)]) {
      const r = await c.db.query<{ anon: boolean; auth: boolean; service: boolean; secdef: boolean; config: string }>(
        `select has_function_privilege('anon', $1, 'EXECUTE') as anon,
                has_function_privilege('authenticated', $1, 'EXECUTE') as auth,
                has_function_privilege('service_role', $1, 'EXECUTE') as service,
                p.prosecdef as secdef,
                array_to_string(p.proconfig, ',') as config
           from pg_proc p where p.oid = $1::regprocedure`,
        [sig],
      );
      expect({ sig, ...r.rows[0] }).toEqual({
        sig,
        anon: false,
        auth: false,
        service: true,
        secdef: false,
        config: 'search_path=public, pg_temp',
      });
    }
    await expect(
      asRole(c.db, 'anon', (d) =>
        d.query('select seva_issue_counter_order($1::jsonb, $2::uuid, $3::uuid)', [
          JSON.stringify(bookOrder(c, '820.00')),
          c.staffId,
          c.deviceId,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('applies the A2-1 migration again without error and keeps working', async () => {
    const c = await setup();
    await issue(c, oneLine(c, { sevaId: c.pan }, '105.00'));
    await expect(applyMigrationFile(c.db, '20261021000000_seva_functions_issue.sql')).resolves.toBeUndefined();
    const again = await issue(c, oneLine(c, { sevaId: c.pan }, '105.00'));
    expect(again.receipts[0].receipt_no).toBe(`C1-023-${c.month}-${c.year}/000002`);
  });
});
