/**
 * Database tests for Task A2-1 (part 3 of 3): recording prints and reprints (seva_record_prints), cancelling with a
 * reason and the money-back state (seva_cancel_receipts, C-20, D23) and the spoiled-print reissue
 * (seva_reissue_spoiled, C-21). A2-FIX2: a spoiled print is reissued on the day it was issued only (an earlier day's
 * slip gets a DUPLICATE reprint instead); an offline cancel names the person who cancelled on the PC, who is checked
 * like an offline issuer, and the person who synced it is recorded separately.
 *
 * Every test starts from its own copy of one migrated template database (a PGlite data-dir clone). Receipts that must
 * look older than the cancel window are inserted directly as fixtures; every rule is proved through the SQL functions,
 * called as service_role.
 */
import { randomBytes, randomUUID } from 'crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { asRole, freshDb } from './harness';
import { seedDevice, seedSeva, seedStaff } from './fixtures';

interface Ctx {
  db: PGlite;
  staffId: string;
  sureshId: string;
  adminId: string;
  deviceId: string;
  pan: string;
  paa: string;
  today: string;
  month: string;
  year: string;
}

interface SqlLine {
  line_no: number;
  seva_id: string;
  quantity: number;
  catalogue_rate: string | null;
  unit_rate: string;
  amount: string;
}

interface SqlReceipt {
  id: string;
  receipt_no: string;
  seva_date: string;
  position: number;
  total: string;
  status: string;
  qr_token: string;
  print_count: number;
  lines: SqlLine[];
}

interface OrderResult {
  order_id: string;
  group_no: string;
  duplicate: boolean;
  receipts: SqlReceipt[];
  new_receipt_id?: string;
  replaced_receipt_id?: string;
}

interface PrintResult {
  receipts: { id: string; receipt_no: string; print_count: number; duplicate: boolean; last_printed_at: string }[];
}

interface CancelResult {
  receipts: { id: string; receipt_no: string; status: string; refund_state: string; refund_note: string | null; total: string }[];
  cash_back: string;
}

interface SevaFailure {
  code: string;
  detail: Record<string, unknown> | null;
}

let template: Blob;
let ctx: Ctx | null = null;
let pastNo = 900000;

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

async function setup(): Promise<Ctx> {
  const db = await PGlite.create({ loadDataDir: template, extensions: { uuid_ossp, pgcrypto } });
  const staffId = await seedStaff(db, { staffNo: 23, name: 'Ramesh', uid: 'uid-ramesh' });
  const sureshId = await seedStaff(db, { staffNo: 24, name: 'Suresh', uid: 'uid-suresh' });
  const adminId = await seedStaff(db, { staffNo: 1, name: 'Temple Admin', uid: 'uid-admin' });
  const deviceId = await seedDevice(db, { staffId });
  const pan = await seedSeva(db, { code: 'PAN', nameEn: 'Panchamrutha Abhisheka', amount: '105.00', multiDate: true });
  const paa = await seedSeva(db, { code: 'PAA', nameEn: 'Paaduka Pooja', amount: '505.00' });
  const parts = await db.query<{ d: string; m: string; y: string }>(
    `select p.business_date::text as d, lpad(p.month::text, 2, '0') as m, p.year::text as y
       from seva_ist_parts(now()) p`,
  );
  ctx = {
    db,
    staffId,
    sureshId,
    adminId,
    deviceId,
    pan,
    paa,
    today: parts.rows[0].d,
    month: parts.rows[0].m,
    year: parts.rows[0].y,
  };
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

function uuidArray(ids: string[]): string {
  return `{${ids.join(',')}}`;
}

/** Issues through the function: one receipt per day offset, each with PAN (and PAA on the first when asked). */
async function issue(
  c: Ctx,
  p: { days: number[]; mode?: 'cash' | 'upi'; withPaa?: boolean; staffId?: string; deviceId?: string },
): Promise<OrderResult> {
  const receipts = p.days.map((d, i) => ({
    client_receipt_id: randomUUID(),
    seva_date: addDays(c.today, d),
    qr_token: qrToken(),
    lines: [
      { seva_id: c.pan, quantity: 1, unit_rate: null },
      ...(p.withPaa && i === 0 ? [{ seva_id: c.paa, quantity: 1, unit_rate: null }] : []),
    ],
  }));
  const total = 105 * p.days.length + (p.withPaa ? 505 : 0);
  const order = {
    client_order_id: randomUUID(),
    expected_total: `${total}.00`,
    devotee: { name: 'Venkatesh Rao' },
    payment: p.mode === 'upi' ? { mode: 'upi', upi_ref_last6: '119042', upi_seen_confirmed: true } : { mode: 'cash' },
    receipts,
  };
  return asRole(c.db, 'service_role', async (d) => {
    const r = await d.query<{ r: OrderResult }>('select seva_issue_counter_order($1::jsonb, $2::uuid, $3::uuid) as r', [
      JSON.stringify(order),
      p.staffId ?? c.staffId,
      p.deviceId ?? c.deviceId,
    ]);
    return r.rows[0].r;
  });
}

/** Counter 2 with its C2 and OF2 series and a live PC, written as fixtures; answers the PC's device id. */
async function secondCounter(c: Ctx): Promise<string> {
  await c.db.query(`insert into counters (id, name, place) values (2, 'Counter 2', 'Hall')`);
  await c.db.query(
    `insert into receipt_series (code, kind, counter_id) values ('C2', 'counter_online', 2), ('OF2', 'counter_offline', 2)`,
  );
  return seedDevice(c.db, { counterId: 2, staffId: c.staffId });
}

/** A Rs 105 online (W series) receipt of today, written directly as a fixture. */
async function insertOnlineReceipt(c: Ctx): Promise<string> {
  pastNo += 1;
  const r = await c.db.query<{ id: string }>(
    `with parts as (select p.year, p.month, p.business_date from seva_ist_parts(now()) p),
          o as (
            insert into seva_orders (group_no, client_order_id, channel, devotee_name, receipts_count, amount_total,
                                     payment_mode, payment_order_id, issued_at)
            values ('G-WEB-' || $1::text, gen_random_uuid(), 'web', 'Online Devotee', 1, 105, 'online',
                    gen_random_uuid(), now())
            returning id, issued_at)
     insert into seva_receipts (receipt_no, series_code, year, month, running_no, order_id, position, client_receipt_id,
                                seva_date, business_date, total, qr_token, prasadam_state, issued_at)
     select 'W-WEB-' || lpad(parts.month::text, 2, '0') || '-' || parts.year::text || '/' || lpad($1::text, 6, '0'),
            'W', parts.year, parts.month, $1::int, o.id, 1, gen_random_uuid(), parts.business_date, parts.business_date,
            105, $2, 'pending', o.issued_at
       from o, parts
     returning id`,
    [pastNo, qrToken()],
  );
  return r.rows[0].id;
}

/** A Rs 105 cash or UPI receipt issued by `staffId` the given minutes ago, written directly as a fixture. */
async function insertPastReceipt(
  c: Ctx,
  p: { minutesAgo: number; mode: 'cash' | 'upi'; staffId?: string; staffNo?: number },
): Promise<string> {
  pastNo += 1;
  const r = await c.db.query<{ id: string }>(
    `with t as (select now() - make_interval(mins => $1::int) as at),
          parts as (select p.year, p.month, p.business_date from t, seva_ist_parts(t.at) p),
          o as (
            insert into seva_orders (group_no, client_order_id, channel, counter_id, device_id, issued_by_staff_id,
                                     devotee_name, receipts_count, amount_total, payment_mode, upi_ref_last6,
                                     upi_seen_confirmed, issued_at)
            select 'G-PAST-' || $5::text, gen_random_uuid(), 'counter', 1, $2::uuid, $3::uuid, 'Lakshmi Bai', 1, 105,
                   $4::text, case when $4::text = 'upi' then '119042' end, case when $4::text = 'upi' then true end, t.at
              from t
            returning id, issued_at)
     insert into seva_receipts (receipt_no, series_code, year, month, running_no, staff_no, order_id, position,
                                client_receipt_id, seva_date, business_date, total, qr_token, prasadam_state, issued_at,
                                issued_by_staff_id, issued_by_name)
     select seva_receipt_no('C1', $6::smallint, null, parts.month, parts.year, $5::int), 'C1', parts.year, parts.month,
            $5::int, $6::smallint, o.id, 1, gen_random_uuid(), parts.business_date + 1, parts.business_date, 105, $7,
            'pending', o.issued_at, $3::uuid, 'Ramesh'
       from o, parts
     returning id`,
    [p.minutesAgo, c.deviceId, p.staffId ?? c.staffId, p.mode, pastNo, p.staffNo ?? 23, qrToken()],
  );
  return r.rows[0].id;
}

async function prints(c: Ctx, ids: string[], deviceId: string = c.deviceId): Promise<PrintResult> {
  return asRole(c.db, 'service_role', async (d) => {
    const r = await d.query<{ r: PrintResult }>('select seva_record_prints($1::uuid[], $2::uuid, $3::uuid) as r', [
      uuidArray(ids),
      c.staffId,
      deviceId,
    ]);
    return r.rows[0].r;
  });
}

/**
 * Calls seva_cancel_receipts. An offline cancel (sent by the outbox) also passes `cancelledByStaffNo`, the staff no. of
 * the person who cancelled on the PC, and `cancellerRole`, that person's role as the sync route reads it.
 */
async function cancel(
  c: Ctx,
  p: {
    ids: string[];
    reason: string;
    note?: string | null;
    staffId?: string;
    isAdmin?: boolean;
    at?: string | null;
    cancelledByStaffNo?: number | null;
    cancellerRole?: string | null;
  },
): Promise<CancelResult> {
  return asRole(c.db, 'service_role', async (d) => {
    const r = await d.query<{ r: CancelResult }>(
      'select seva_cancel_receipts($1::uuid[], $2, $3, $4::uuid, $5::boolean, $6::timestamptz, $7::integer, $8::text) as r',
      [
        uuidArray(p.ids),
        p.reason,
        p.note ?? null,
        p.staffId ?? c.staffId,
        p.isAdmin ?? false,
        p.at ?? null,
        p.cancelledByStaffNo ?? null,
        p.cancellerRole ?? null,
      ],
    );
    return r.rows[0].r;
  });
}

/** An offline cancel sent by the outbox, made on the PC by Ramesh (023), who issued the fixtures. */
const OFFLINE_23 = { cancelledByStaffNo: 23, cancellerRole: 'receptionist' } as const;

/** The receipt's issue time plus an interval, as text the function reads back exactly. */
async function issuedAtPlus(c: Ctx, id: string, plus: string): Promise<string> {
  const r = await c.db.query<{ t: string }>(`select (issued_at + $2::interval)::text as t from seva_receipts where id = $1`, [
    id,
    plus,
  ]);
  return r.rows[0].t;
}

interface AuditRow {
  action: string;
  entity_id: string;
  actor_staff_id: string | null;
  actor_role: string | null;
  after: Record<string, unknown> | null;
}

async function auditRows(db: PGlite): Promise<AuditRow[]> {
  const r = await db.query<AuditRow>('select action, entity_id, actor_staff_id, actor_role, after from audit_log order by id');
  return r.rows;
}

async function reissue(c: Ctx, receiptId: string, token: string, deviceId: string = c.deviceId): Promise<OrderResult> {
  return asRole(c.db, 'service_role', async (d) => {
    const r = await d.query<{ r: OrderResult }>('select seva_reissue_spoiled($1::uuid, $2::uuid, $3::uuid, $4) as r', [
      receiptId,
      c.staffId,
      deviceId,
      token,
    ]);
    return r.rows[0].r;
  });
}

interface DayClosePrepRow {
  receipts: number;
  cancelled: number;
  cash_expected: string;
  upi_expected: string;
  [key: string]: unknown;
}

/** What the close-day screen shows for Counter 1 on one business date (A2-2's seva_prepare_day_close). */
async function prepareDayClose(c: Ctx, businessDate: string): Promise<DayClosePrepRow> {
  return asRole(c.db, 'service_role', async (d) => {
    const r = await d.query<{ r: DayClosePrepRow }>('select seva_prepare_day_close(1::smallint, $1::date) as r', [
      businessDate,
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

async function receiptRow(
  db: PGlite,
  id: string,
): Promise<{ status: string; cancel_reason_code: string | null; cancel_note: string | null; refund_state: string; refund_note: string | null; cancelled_by_staff_id: string | null }> {
  const r = await db.query<{
    status: string;
    cancel_reason_code: string | null;
    cancel_note: string | null;
    refund_state: string;
    refund_note: string | null;
    cancelled_by_staff_id: string | null;
  }>(
    `select status, cancel_reason_code, cancel_note, refund_state, refund_note, cancelled_by_staff_id
       from seva_receipts where id = $1`,
    [id],
  );
  return r.rows[0];
}

describe('seva_record_prints (A2-1)', () => {
  it('first print sets print_count 1; a second print is a duplicate and is audited', async () => {
    const c = await setup();
    const order = await issue(c, { days: [1, 2] });
    const [a, b] = order.receipts.map((r) => r.id);

    const first = await prints(c, [a, b]);
    expect(first.receipts.map((r) => [r.id, r.print_count, r.duplicate])).toEqual([
      [a, 1, false],
      [b, 1, false],
    ]);
    expect(await count(c.db, 'audit_log')).toBe(0);
    expect(await count(c.db, 'seva_receipts', 'first_printed_at is not null and last_printed_at is not null')).toBe(2);

    const again = await prints(c, [a]);
    expect(again.receipts).toEqual([
      { id: a, receipt_no: order.receipts[0].receipt_no, print_count: 2, duplicate: true, last_printed_at: expect.any(String) },
    ]);
    const audit = await c.db.query('select action, entity, entity_id, receipt_no, actor_staff_id from audit_log');
    expect(audit.rows).toEqual([
      { action: 'receipt.reprint', entity: 'receipt', entity_id: a, receipt_no: order.receipts[0].receipt_no, actor_staff_id: c.staffId },
    ]);

    // The same id twice in one call is one print.
    const twice = await prints(c, [b, b]);
    expect(twice.receipts.map((r) => [r.id, r.print_count])).toEqual([[b, 2]]);
  });

  it('refuses to print a cancelled receipt', async () => {
    const c = await setup();
    const order = await issue(c, { days: [1] });
    const id = order.receipts[0].id;
    await cancel(c, { ids: [id], reason: 'wrong_seva' });

    expect(await failure(prints(c, [id]))).toMatchObject({ code: 'cannot_reprint_cancelled' });
    expect((await failure(prints(c, [randomUUID()]))).code).toBe('not_found');
    expect((await failure(prints(c, []))).code).toBe('validation');
    expect((await failure(prints(c, [id], randomUUID()))).code).toBe('device_unknown');
    expect(await count(c.db, 'seva_receipts', 'print_count > 0')).toBe(0);
  });

  it("prints another counter's receipt for the first time only from that counter's PC; online W receipts anywhere (A3-FIX 10)", async () => {
    const c = await setup();
    const pc2 = await secondCounter(c);
    const atCounter2 = (await issue(c, { days: [1], deviceId: pc2 })).receipts[0].id;
    const online = await insertOnlineReceipt(c);
    const own = (await issue(c, { days: [1] })).receipts[0].id;

    // Counter 1's PC may not give a Counter 2 receipt its first print, even alongside its own: nothing is printed.
    expect(await failure(prints(c, [own, atCounter2]))).toMatchObject({ code: 'forbidden' });
    expect(await count(c.db, 'seva_receipts', 'print_count > 0')).toBe(0);
    // Its own counter's receipt and an online W receipt are fine.
    expect((await prints(c, [own, online])).receipts.map((r) => [r.id, r.print_count])).toEqual([
      [own, 1],
      [online, 1],
    ]);
    // Counter 2's own PC prints it; after that a reprint from elsewhere is the route's decision (receipt.reprint).
    expect((await prints(c, [atCounter2], pc2)).receipts.map((r) => r.print_count)).toEqual([1]);
    expect((await prints(c, [atCounter2])).receipts.map((r) => [r.print_count, r.duplicate])).toEqual([[2, true]]);
  });
});

describe('seva_cancel_receipts (A2-1)', () => {
  it('lets the issuer cancel inside the window and hands cash back the same day', async () => {
    const c = await setup();
    const order = await issue(c, { days: [1, 2, 3], withPaa: true });
    const ids = order.receipts.map((r) => r.id);

    const res = await cancel(c, { ids, reason: 'wrong_seva' });
    expect(res.cash_back).toBe('820.00');
    expect(res.receipts.map((r) => [r.id, r.status, r.refund_state, r.refund_note])).toEqual(
      ids.map((id) => [id, 'cancelled', 'done', 'Given back from the drawer']),
    );
    expect(await receiptRow(c.db, ids[0])).toEqual({
      status: 'cancelled',
      cancel_reason_code: 'wrong_seva',
      cancel_note: null,
      refund_state: 'done',
      refund_note: 'Given back from the drawer',
      cancelled_by_staff_id: c.staffId,
    });
    const audit = await c.db.query<{ action: string; entity_id: string; reason: string }>(
      'select action, entity_id, reason from audit_log order by id',
    );
    expect(audit.rows.map((r) => [r.action, r.entity_id])).toEqual(ids.map((id) => ['receipt.cancel', id]));
    expect(audit.rows.every((r) => r.reason.includes('wrong_seva'))).toBe(true);
  });

  it("refuses the issuer after the window and refuses other people's receipts", async () => {
    const c = await setup();
    const old = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });
    expect(await failure(cancel(c, { ids: [old], reason: 'wrong_seva' }))).toMatchObject({ code: 'cancel_window_passed' });

    const mine = await issue(c, { days: [1] });
    expect((await failure(cancel(c, { ids: [mine.receipts[0].id], reason: 'wrong_seva', staffId: c.sureshId }))).code).toBe(
      'forbidden',
    );
    // A group cancel stops as a whole when one receipt is refused.
    expect((await failure(cancel(c, { ids: [mine.receipts[0].id, old], reason: 'wrong_seva' }))).code).toBe(
      'cancel_window_passed',
    );
    expect(await count(c.db, 'seva_receipts', `status = 'cancelled'`)).toBe(0);

    // The window comes from the settings.
    await c.db.query('update seva_settings set cancel_window_minutes = 60 where id = 1');
    await expect(cancel(c, { ids: [old], reason: 'wrong_seva' })).resolves.toMatchObject({
      receipts: [{ id: old, status: 'cancelled' }],
    });
  });

  it('lets an admin cancel any receipt at any time', async () => {
    const c = await setup();
    const old = await insertPastReceipt(c, { minutesAgo: 3 * 24 * 60, mode: 'cash' });
    const res = await cancel(c, { ids: [old], reason: 'entered_twice', staffId: c.adminId, isAdmin: true });
    expect(res.receipts).toEqual([expect.objectContaining({ id: old, status: 'cancelled', refund_state: 'due' })]);
    expect((await receiptRow(c.db, old)).cancelled_by_staff_id).toBe(c.adminId);

    const someoneElses = await issue(c, { days: [1], staffId: c.sureshId });
    await expect(
      cancel(c, { ids: [someoneElses.receipts[0].id], reason: 'changed_mind', staffId: c.adminId, isAdmin: true }),
    ).resolves.toMatchObject({ receipts: [{ status: 'cancelled', refund_state: 'done' }] });
  });

  it('sets refund due for UPI and for cash from an earlier day', async () => {
    const c = await setup();
    const upi = await issue(c, { days: [1], mode: 'upi' });
    const upiRes = await cancel(c, { ids: [upi.receipts[0].id], reason: 'changed_mind' });
    expect(upiRes.cash_back).toBe('0.00');
    expect(upiRes.receipts).toEqual([expect.objectContaining({ refund_state: 'due', refund_note: null })]);

    const yesterday = await insertPastReceipt(c, { minutesAgo: 24 * 60 + 5, mode: 'cash' });
    const cashRes = await cancel(c, { ids: [yesterday], reason: 'wrong_date', staffId: c.adminId, isAdmin: true });
    expect(cashRes.cash_back).toBe('0.00');
    expect(cashRes.receipts).toEqual([expect.objectContaining({ refund_state: 'due', refund_note: null })]);
  });

  it('needs a note for reason other and refuses a second cancel', async () => {
    const c = await setup();
    const order = await issue(c, { days: [1] });
    const id = order.receipts[0].id;

    expect(await failure(cancel(c, { ids: [id], reason: 'other' }))).toEqual({ code: 'validation', detail: { field: 'note' } });
    expect(await failure(cancel(c, { ids: [id], reason: 'other', note: ' ab ' }))).toEqual({
      code: 'validation',
      detail: { field: 'note' },
    });
    for (const reason of ['not_printed_connection_lost', 'refunded', 'bogus']) {
      expect({ reason, failure: await failure(cancel(c, { ids: [id], reason })) }).toEqual({
        reason,
        failure: { code: 'validation', detail: { field: 'reason_code' } },
      });
    }
    const inactive = await seedStaff(c.db, { staffNo: 26, name: 'Former', uid: 'uid-former' });
    await c.db.query(`update staff set status = 'inactive', status_reason = 'Left' where id = $1`, [inactive]);
    expect((await failure(cancel(c, { ids: [id], reason: 'wrong_seva', staffId: inactive, isAdmin: true }))).code).toBe(
      'staff_inactive',
    );

    await cancel(c, { ids: [id], reason: 'other', note: 'Devotee wants the name changed' });
    expect(await receiptRow(c.db, id)).toMatchObject({ cancel_reason_code: 'other', cancel_note: 'Devotee wants the name changed' });
    expect(await failure(cancel(c, { ids: [id], reason: 'wrong_seva', staffId: c.adminId, isAdmin: true }))).toMatchObject({
      code: 'already_cancelled',
    });
  });

  it('uses p_at for the window of an offline cancel', async () => {
    const c = await setup();
    const issuedAt = async (id: string, plus: string): Promise<string> => {
      const r = await c.db.query<{ t: string }>(`select (issued_at + $2::interval)::text as t from seva_receipts where id = $1`, [
        id,
        plus,
      ]);
      return r.rows[0].t;
    };
    const cancelledAt = async (id: string): Promise<string> => {
      const r = await c.db.query<{ t: string }>('select cancelled_at::text as t from seva_receipts where id = $1', [id]);
      return r.rows[0].t;
    };

    // Cancelled on the PC 10 minutes after issue, synced 30 minutes later: inside the window.
    const inside = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });
    const at10 = await issuedAt(inside, '10 minutes');
    await expect(cancel(c, { ids: [inside], reason: 'wrong_seva', ...OFFLINE_23, at: at10 })).resolves.toMatchObject({
      receipts: [{ status: 'cancelled' }],
    });
    expect(await cancelledAt(inside)).toBe(at10);

    const outside = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });
    expect(
      (await failure(cancel(c, { ids: [outside], reason: 'wrong_seva', ...OFFLINE_23, at: await issuedAt(outside, '31 minutes') }))).code,
    ).toBe('cancel_window_passed');

    // p_at is never earlier than the issue time ...
    const early = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });
    await cancel(c, { ids: [early], reason: 'wrong_seva', ...OFFLINE_23, at: await issuedAt(early, '-60 minutes') });
    expect(await cancelledAt(early)).toBe(await issuedAt(early, '0 minutes'));

    // ... nor later than now.
    const fresh = await issue(c, { days: [1] });
    await cancel(c, { ids: [fresh.receipts[0].id], reason: 'wrong_seva', ...OFFLINE_23, at: new Date(Date.now() + 2 * 3600_000).toISOString() });
    expect(await count(c.db, 'seva_receipts', `id = '${fresh.receipts[0].id}' and cancelled_at <= now()`)).toBe(1);
  });
});

describe('seva_cancel_receipts - offline cancels from the outbox (A2-FIX2)', () => {
  it('names the person who cancelled on the PC as canceller and records the person who synced separately', async () => {
    const c = await setup();
    // Ramesh (023) issued the receipt and cancelled it on the PC 10 minutes later; Suresh signed in before the
    // outbox sent the cancel, 30 minutes after that. The window is measured to the cancel's recorded time.
    const receipt = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });
    const at = await issuedAtPlus(c, receipt, '10 minutes');

    const res = await cancel(c, {
      ids: [receipt],
      reason: 'wrong_seva',
      staffId: c.sureshId,
      at,
      cancelledByStaffNo: 23,
      cancellerRole: 'receptionist',
    });
    expect(res.receipts).toEqual([expect.objectContaining({ id: receipt, status: 'cancelled' })]);
    expect(await receiptRow(c.db, receipt)).toMatchObject({
      status: 'cancelled',
      cancel_reason_code: 'wrong_seva',
      cancelled_by_staff_id: c.staffId,
    });
    expect(await auditRows(c.db)).toEqual([
      {
        action: 'receipt.cancel',
        entity_id: receipt,
        actor_staff_id: c.staffId,
        actor_role: 'receptionist',
        after: expect.objectContaining({ status: 'cancelled', offline: true, synced_by_staff_id: c.sureshId, by_admin: false }),
      },
    ]);
  });

  it('checks the offline canceller like an offline issuer and keeps the counter rule', async () => {
    const c = await setup();
    await seedStaff(c.db, { staffNo: 26, name: 'Invited', uid: 'uid-invited', status: 'invited' });
    const gone = await seedStaff(c.db, { staffNo: 27, name: 'Gone', uid: 'uid-gone' });
    await c.db.query(`update staff set status = 'deleted', status_reason = 'Removed' where id = $1`, [gone]);
    const receipt = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });
    const at10 = await issuedAtPlus(c, receipt, '10 minutes');
    const offline = (p: { no: number; role: string | null; at?: string | null; isAdmin?: boolean }): Promise<CancelResult> =>
      cancel(c, {
        ids: [receipt],
        reason: 'wrong_seva',
        staffId: c.sureshId,
        at: p.at === undefined ? at10 : p.at,
        isAdmin: p.isAdmin ?? false,
        cancelledByStaffNo: p.no,
        cancellerRole: p.role,
      });

    // Cancelled on the PC 31 minutes after issue: past the window, however soon it is synced.
    expect(
      (await failure(offline({ no: 23, role: 'receptionist', at: await issuedAtPlus(c, receipt, '31 minutes') }))).code,
    ).toBe('cancel_window_passed');
    // Only the issuer cancels offline: not another receptionist, and not a temple admin either (DB 9.11).
    expect((await failure(offline({ no: 24, role: 'receptionist' }))).code).toBe('forbidden');
    expect((await failure(offline({ no: 1, role: 'temple_admin', isAdmin: true }))).code).toBe('forbidden');
    // Unknown, invited or deleted people, and roles that may not use the counter, are refused.
    for (const [no, role] of [
      [99, 'receptionist'],
      [26, 'receptionist'],
      [27, 'receptionist'],
      [23, 'prasadam_counter'],
      [23, null],
    ] as [number, string | null][]) {
      expect({ no, role, f: await failure(offline({ no, role })) }).toEqual({
        no,
        role,
        f: { code: 'validation', detail: expect.objectContaining({ field: 'cancelled_by_staff_no' }) },
      });
    }
    // An offline cancel carries the time it was made on the PC.
    expect(await failure(offline({ no: 23, role: 'receptionist', at: null }))).toEqual({
      code: 'validation',
      detail: { field: 'at' },
    });
    expect(await count(c.db, 'seva_receipts', `status = 'cancelled'`)).toBe(0);
    expect(await count(c.db, 'audit_log')).toBe(0);

    // Offboarded after cancelling on the PC: still accepted, and the audit trail says so.
    await c.db.query(
      `update staff set status = 'inactive', status_reason = 'Left the temple office', status_changed_at = now() where id = $1`,
      [c.staffId],
    );
    await expect(offline({ no: 23, role: 'receptionist' })).resolves.toMatchObject({ receipts: [{ id: receipt, status: 'cancelled' }] });
    expect((await receiptRow(c.db, receipt)).cancelled_by_staff_id).toBe(c.staffId);
    expect(await auditRows(c.db)).toEqual([
      expect.objectContaining({ action: 'receipt.cancel', entity_id: receipt, actor_staff_id: c.staffId }),
      expect.objectContaining({
        action: 'receipt.issuer_inactive_at_sync',
        entity_id: receipt,
        actor_staff_id: c.sureshId,
        after: expect.objectContaining({ issuer_staff_id: c.staffId, issuer_staff_no: 23, synced_by_staff_id: c.sureshId }),
      }),
    ]);
  });

  it('refuses a cancel time unless the outbox names who cancelled on the PC (A3-1)', async () => {
    const c = await setup();
    const receipt = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });
    const at = await issuedAtPlus(c, receipt, '10 minutes');
    // An online cancel is measured to now(); only an offline cancel carries the time it was made, so a caller cannot
    // move the window back by passing p_at alone - neither the issuer nor an admin.
    expect(await failure(cancel(c, { ids: [receipt], reason: 'wrong_seva', at }))).toEqual({
      code: 'validation',
      detail: expect.objectContaining({ field: 'at' }),
    });
    expect(
      await failure(cancel(c, { ids: [receipt], reason: 'wrong_seva', staffId: c.adminId, isAdmin: true, at })),
    ).toEqual({ code: 'validation', detail: expect.objectContaining({ field: 'at' }) });
    expect(await count(c.db, 'seva_receipts', `status = 'cancelled'`)).toBe(0);
    expect(await count(c.db, 'audit_log')).toBe(0);
  });

  it('flags an offline cancel whose recorded time falls in an already-closed day (A3-1)', async () => {
    const c = await setup();
    const first = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });
    const second = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });

    const open = await cancel(c, {
      ids: [first],
      reason: 'wrong_seva',
      staffId: c.sureshId,
      at: await issuedAtPlus(c, first, '10 minutes'),
      ...OFFLINE_23,
    });
    expect(open.receipts).toEqual([expect.objectContaining({ id: first, status: 'cancelled', in_closed_day: false })]);

    // The counter closed the day of the second cancel's recorded time before the outbox sent it.
    const atSecond = await issuedAtPlus(c, second, '10 minutes');
    const day = (
      await c.db.query<{ d: string }>('select p.business_date::text as d from seva_ist_parts($1::timestamptz) p', [atSecond])
    ).rows[0].d;
    await c.db.query(
      `insert into day_closes (counter_id, business_date, status, cash_expected, cash_counted, series_ranges,
                               outbox_pending, closed_by_staff_id, closed_at)
       values (1, $1::date, 'closed', 0, 0, '[]'::jsonb, 0, $2::uuid, now())`,
      [day, c.adminId],
    );
    const late = await cancel(c, { ids: [second], reason: 'wrong_seva', staffId: c.sureshId, at: atSecond, ...OFFLINE_23 });
    // Still accepted - the slip was cancelled on the PC - but flagged for the office in the answer and the audit row.
    expect(late.receipts).toEqual([expect.objectContaining({ id: second, status: 'cancelled', in_closed_day: true })]);
    const audit = (await auditRows(c.db)).filter((r) => r.action === 'receipt.cancel');
    expect(audit.map((r) => [r.entity_id, r.after?.in_closed_day, r.after?.closed_business_date])).toEqual([
      [first, false, undefined],
      [second, true, day],
    ]);
  });

  it('refuses an inactive canceller whose cancel is dated after they were offboarded (A3 gate M-2 a)', async () => {
    const c = await setup();
    const receipt = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });
    const at10 = await issuedAtPlus(c, receipt, '10 minutes');
    const offline = (): Promise<CancelResult> =>
      cancel(c, { ids: [receipt], reason: 'wrong_seva', staffId: c.sureshId, at: at10, ...OFFLINE_23 });

    // Offboarded 5 minutes after issuing, so a cancel "made" 10 minutes after issuing came after the offboarding.
    await c.db.query(
      `update staff set status = 'inactive', status_reason = 'Left', status_changed_at = $2::timestamptz where id = $1`,
      [c.staffId, await issuedAtPlus(c, receipt, '5 minutes')],
    );
    expect(await failure(offline())).toEqual({
      code: 'validation',
      detail: expect.objectContaining({ field: 'cancelled_by_staff_no', reason: expect.stringContaining('offboarded') }),
    });
    // An inactive row with no offboarding time is refused too: the time cannot be compared.
    await c.db.query(`update staff set status_changed_at = null where id = $1`, [c.staffId]);
    expect((await failure(offline())).code).toBe('validation');
    expect(await count(c.db, 'seva_receipts', `status = 'cancelled'`)).toBe(0);
    expect(await count(c.db, 'audit_log')).toBe(0);
  });

  it('makes a late offline cash cancel, or one in a closed day, a refund due for the office (A3 gate M-2 c)', async () => {
    const c = await setup();
    // Cancelled on the PC 5 minutes after issue and sent 5 minutes later: cash handed back from the drawer.
    const onTime = await insertPastReceipt(c, { minutesAgo: 10, mode: 'cash' });
    // Cancelled on the PC 5 minutes after issue but sent 35 minutes later, past the 30-minute window.
    const late = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });
    const fast = await cancel(c, {
      ids: [onTime],
      reason: 'wrong_seva',
      at: await issuedAtPlus(c, onTime, '5 minutes'),
      ...OFFLINE_23,
    });
    expect(fast).toMatchObject({ receipts: [{ id: onTime, refund_state: 'done' }], cash_back: '105.00' });
    const slow = await cancel(c, {
      ids: [late],
      reason: 'wrong_seva',
      at: await issuedAtPlus(c, late, '5 minutes'),
      ...OFFLINE_23,
    });
    expect(slow).toMatchObject({ receipts: [{ id: late, refund_state: 'due', refund_note: null }], cash_back: '0.00' });
    expect(await receiptRow(c.db, late)).toMatchObject({ refund_state: 'due' });
    const audit = (await auditRows(c.db)).filter((r) => r.action === 'receipt.cancel');
    expect(audit.map((r) => [r.entity_id, r.after?.refund_state, r.after?.late_sync])).toEqual([
      [onTime, 'done', false],
      [late, 'due', true],
    ]);

    // An offline cash cancel recorded in a day the counter has already closed is due as well, even when on time.
    const closedDay = await insertPastReceipt(c, { minutesAgo: 10, mode: 'cash' });
    await c.db.query(
      `insert into day_closes (counter_id, business_date, status, cash_expected, cash_counted, series_ranges,
                               outbox_pending, closed_by_staff_id, closed_at)
       select 1, r.business_date, 'closed', 0, 0, '[]'::jsonb, 0, $2::uuid, now() from seva_receipts r where r.id = $1`,
      [closedDay, c.adminId],
    );
    const inClosed = await cancel(c, {
      ids: [closedDay],
      reason: 'wrong_seva',
      at: await issuedAtPlus(c, closedDay, '5 minutes'),
      ...OFFLINE_23,
    });
    expect(inClosed).toMatchObject({ receipts: [{ id: closedDay, refund_state: 'due', in_closed_day: true }], cash_back: '0.00' });
  });

  it('makes an offline cancel late when it reaches the server after issue time + window (A3 re-review N-2)', async () => {
    const c = await setup();
    // Issued 40 minutes ago; "cancelled on the PC" 25 minutes after issue (inside the window) and sent now, only 15
    // minutes after that recorded time. The online window closed 10 minutes ago, so the drawer cannot be trusted.
    const stretched = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });
    const answer = await cancel(c, {
      ids: [stretched],
      reason: 'wrong_seva',
      at: await issuedAtPlus(c, stretched, '25 minutes'),
      ...OFFLINE_23,
    });
    expect(answer).toMatchObject({ receipts: [{ id: stretched, refund_state: 'due', refund_note: null }], cash_back: '0.00' });
    expect(await receiptRow(c.db, stretched)).toMatchObject({ refund_state: 'due' });
    const audit = (await auditRows(c.db)).filter((r) => r.action === 'receipt.cancel');
    expect(audit.map((r) => [r.entity_id, r.after?.refund_state, r.after?.late_sync])).toEqual([[stretched, 'due', true]]);

    // The Needs attention card flags it, though canceller and syncer are the same person.
    const cards = await asRole(c.db, 'service_role', async (d) =>
      (
        await d.query<{ cards: { id: string; level: string; count: number; detail: Record<string, unknown>; entries?: Record<string, unknown>[] }[] }>(
          `select seva_needs_attention(now() - interval '1 hour', now() + interval '1 hour', $1::date) as cards`,
          [c.today],
        )
      ).rows[0].cards,
    );
    expect(cards.find((x) => x.id === 'offline_cancels')).toMatchObject({
      level: 'attention',
      count: 1,
      detail: { flagged: 1 },
      entries: [expect.objectContaining({ cancelled_by: 'Ramesh', synced_by: 'Ramesh', flagged: true })],
    });
  });

  it('checks an offboarded canceller against the clamped cancel time, not the raw one (A3 re-review hardening)', async () => {
    const c = await setup();
    const receipt = await insertPastReceipt(c, { minutesAgo: 10, mode: 'cash' });
    // A crafted row: offboarded 5 minutes before the receipt's issue time. The outbox claims a time 10 minutes before
    // issue, which is before the offboarding - but the cancel is held at the issue time, which is after it.
    await c.db.query(
      `update staff set status = 'inactive', status_reason = 'Left', status_changed_at = $2::timestamptz where id = $1`,
      [c.staffId, await issuedAtPlus(c, receipt, '-5 minutes')],
    );
    expect(
      await failure(
        cancel(c, { ids: [receipt], reason: 'wrong_seva', at: await issuedAtPlus(c, receipt, '-10 minutes'), staffId: c.sureshId, ...OFFLINE_23 }),
      ),
    ).toEqual({
      code: 'validation',
      detail: expect.objectContaining({ field: 'cancelled_by_staff_no', reason: expect.stringContaining('offboarded') }),
    });
    expect(await count(c.db, 'seva_receipts', `status = 'cancelled'`)).toBe(0);
    expect(await count(c.db, 'audit_log')).toBe(0);

    // Offboarded after the issue time: the same claimed time is held at the issue time, before the offboarding.
    await c.db.query(`update staff set status_changed_at = $2::timestamptz where id = $1`, [
      c.staffId,
      await issuedAtPlus(c, receipt, '2 minutes'),
    ]);
    await expect(
      cancel(c, { ids: [receipt], reason: 'wrong_seva', at: await issuedAtPlus(c, receipt, '-10 minutes'), staffId: c.sureshId, ...OFFLINE_23 }),
    ).resolves.toMatchObject({ receipts: [{ id: receipt, status: 'cancelled' }] });
  });

  it('lists offline cancels in Needs attention, flagging another syncer or a late sync (A3 gate M-2 b)', async () => {
    const c = await setup();
    const offlineCard = async (): Promise<{ level: string; count: number; detail: Record<string, unknown>; entries?: Record<string, unknown>[] }> => {
      const cards = await asRole(c.db, 'service_role', async (d) =>
        (
          await d.query<{ cards: { id: string; level: string; count: number; detail: Record<string, unknown> }[] }>(
            `select seva_needs_attention(now() - interval '1 hour', now() + interval '1 hour', $1::date) as cards`,
            [c.today],
          )
        ).rows[0].cards,
      );
      const found = cards.find((x) => x.id === 'offline_cancels');
      if (!found) throw new Error('card offline_cancels missing');
      return found;
    };
    expect(await offlineCard()).toMatchObject({ level: 'ok', count: 0, entries: [] });

    // Ramesh cancels his own receipt on the PC and sends it himself, in time: listed, not flagged.
    const own = await insertPastReceipt(c, { minutesAgo: 10, mode: 'cash' });
    const ownAt = await issuedAtPlus(c, own, '5 minutes');
    await cancel(c, { ids: [own], reason: 'wrong_seva', at: ownAt, ...OFFLINE_23 });
    // An online cancel is not an offline cancel.
    const online = await insertPastReceipt(c, { minutesAgo: 10, mode: 'cash' });
    await cancel(c, { ids: [online], reason: 'wrong_seva' });
    expect(await offlineCard()).toMatchObject({ level: 'ok', count: 1, detail: { flagged: 0 } });

    // Suresh sends a cancel in Ramesh's name; and Ramesh's own cancel arrives 35 minutes after it was made.
    const other = await insertPastReceipt(c, { minutesAgo: 10, mode: 'cash' });
    await cancel(c, { ids: [other], reason: 'wrong_seva', staffId: c.sureshId, at: await issuedAtPlus(c, other, '5 minutes'), ...OFFLINE_23 });
    const late = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });
    await cancel(c, { ids: [late], reason: 'wrong_seva', at: await issuedAtPlus(c, late, '5 minutes'), ...OFFLINE_23 });

    const card = await offlineCard();
    expect(card).toMatchObject({ level: 'attention', count: 3, detail: { flagged: 2 } });
    const numbers = await c.db.query<{ id: string; receipt_no: string }>(
      'select id, receipt_no from seva_receipts where id = any($1::uuid[])',
      [uuidArray([own, other, late])],
    );
    const no = (id: string): string => numbers.rows.find((r) => r.id === id)?.receipt_no ?? '';
    expect(card.entries).toEqual([
      expect.objectContaining({ receipt_no: no(late), cancelled_by: 'Ramesh', synced_by: 'Ramesh', flagged: true }),
      expect.objectContaining({ receipt_no: no(other), cancelled_by: 'Ramesh', synced_by: 'Suresh', flagged: true }),
      expect.objectContaining({ receipt_no: no(own), cancelled_by: 'Ramesh', synced_by: 'Ramesh', flagged: false }),
    ]);
    // The recorded time is when it was cancelled on the PC; the received time is when the outbox sent it.
    const [lateEntry] = card.entries ?? [];
    const recorded = Date.parse(String(lateEntry.recorded_at));
    const received = Date.parse(String(lateEntry.received_at));
    expect(received - recorded).toBeGreaterThan(30 * 60_000);
    const stored = await c.db.query<{ same: boolean }>(
      `select cancelled_at = $2::timestamptz as same from seva_receipts where id = $1`,
      [late, String(lateEntry.recorded_at)],
    );
    expect(stored.rows).toEqual([{ same: true }]);
  });
});

describe('seva_cancel_receipts - an online cancel on a closed day (A5-FIX M-1)', () => {
  async function closeDay(c: Ctx, day: string): Promise<void> {
    await c.db.query(
      `insert into day_closes (counter_id, business_date, status, cash_expected, cash_counted, series_ranges,
                               outbox_pending, closed_by_staff_id, closed_at)
       values (1, $1::date, 'closed', 0, 0, '[]'::jsonb, 0, $2::uuid, now())`,
      [day, c.adminId],
    );
  }

  it('refuses the receptionist inside the window once the day is closed', async () => {
    const c = await setup();
    const order = await issue(c, { days: [1] });
    await closeDay(c, c.today);
    expect(await failure(cancel(c, { ids: [order.receipts[0].id], reason: 'wrong_seva' }))).toMatchObject({
      code: 'day_closed',
      detail: { business_date: c.today },
    });
    expect(await count(c.db, 'seva_receipts', `status = 'cancelled'`)).toBe(0);
  });

  it('lets an admin cancel, but the cash of a closed day is a refund due, not handed back from the drawer', async () => {
    const c = await setup();
    const order = await issue(c, { days: [1] });
    const id = order.receipts[0].id;
    await closeDay(c, c.today);
    const res = await cancel(c, { ids: [id], reason: 'entered_twice', staffId: c.adminId, isAdmin: true });
    expect(res.cash_back).toBe('0.00');
    expect(res.receipts).toEqual([
      expect.objectContaining({ id, status: 'cancelled', refund_state: 'due', refund_note: null, in_closed_day: true }),
    ]);
    const audit = (await auditRows(c.db)).filter((r) => r.action === 'receipt.cancel');
    expect(audit.map((r) => [r.entity_id, r.after?.in_closed_day, r.after?.closed_business_date])).toEqual([
      [id, true, c.today],
    ]);
  });

  it('an open day still hands the cash back', async () => {
    const c = await setup();
    const order = await issue(c, { days: [1] });
    const res = await cancel(c, { ids: [order.receipts[0].id], reason: 'wrong_seva' });
    expect(res.cash_back).toBe('105.00');
    expect(res.receipts).toEqual([expect.objectContaining({ refund_state: 'done', in_closed_day: false })]);
  });
});

describe('seva_reissue_spoiled (A2-1)', () => {
  it('spoiled reissue cancels with spoiled_print and issues the next number on the same order', async () => {
    const c = await setup();
    const order = await issue(c, { days: [1, 2], withPaa: true });
    const [spoiled, other] = order.receipts;
    await prints(c, [spoiled.id, other.id]);
    const token = qrToken();

    const res = await reissue(c, spoiled.id, token);
    const prefix = `C1-023-${c.month}-${c.year}/`;
    expect(res.order_id).toBe(order.order_id);
    expect(res.replaced_receipt_id).toBe(spoiled.id);
    const fresh = res.receipts.find((r) => r.id === res.new_receipt_id);
    expect(fresh).toMatchObject({
      receipt_no: `${prefix}000003`,
      seva_date: spoiled.seva_date,
      position: spoiled.position,
      total: spoiled.total,
      status: 'issued',
      qr_token: token,
      print_count: 0,
    });
    expect(fresh?.lines.map((l) => [l.line_no, l.seva_id, l.quantity, l.catalogue_rate, l.unit_rate, l.amount])).toEqual(
      spoiled.lines.map((l) => [l.line_no, l.seva_id, l.quantity, l.catalogue_rate, l.unit_rate, l.amount]),
    );

    const row = await c.db.query('select replaces_receipt_id, order_id from seva_receipts where id = $1', [res.new_receipt_id]);
    expect(row.rows).toEqual([{ replaces_receipt_id: spoiled.id, order_id: order.order_id }]);
    expect(await receiptRow(c.db, spoiled.id)).toMatchObject({
      status: 'cancelled',
      cancel_reason_code: 'spoiled_print',
      cancel_note: `Spoiled print; reissued as ${prefix}000003`,
      // The money stays on the same payment: nothing to hand back.
      refund_state: 'none',
      cancelled_by_staff_id: c.staffId,
    });
    const audit = await c.db.query('select action, entity_id, receipt_no from audit_log');
    expect(audit.rows).toEqual([{ action: 'receipt.reissue_spoiled', entity_id: spoiled.id, receipt_no: spoiled.receipt_no }]);

    expect((await failure(reissue(c, spoiled.id, qrToken()))).code).toBe('already_cancelled');
    expect(await failure(reissue(c, other.id, 'short'))).toEqual({ code: 'validation', detail: { field: 'qr_token' } });
    expect(await failure(reissue(c, other.id, token))).toEqual({ code: 'validation', detail: { field: 'qr_token' } });
    expect((await failure(reissue(c, randomUUID(), qrToken()))).code).toBe('not_found');
    expect(await count(c.db, 'seva_receipts')).toBe(3);
  });

  it("refuses to reissue another counter's receipt from this PC (A3 gate L-3)", async () => {
    const c = await setup();
    const pc2 = await secondCounter(c);
    const atCounter2 = (await issue(c, { days: [1], deviceId: pc2 })).receipts[0].id;

    expect(await failure(reissue(c, atCounter2, qrToken()))).toMatchObject({
      code: 'validation',
      detail: { field: 'receipt_id' },
    });
    // Nothing moved: no cancel, no new number on either counter, no audit row.
    expect(await receiptRow(c.db, atCounter2)).toMatchObject({ status: 'issued' });
    expect(await count(c.db, 'seva_receipts')).toBe(1);
    expect(await count(c.db, 'receipt_series_years', `series_code = 'C1' and last_no > 0`)).toBe(0);
    expect(await count(c.db, 'audit_log')).toBe(0);
    // Counter 2's own PC reissues it.
    const res = await reissue(c, atCounter2, qrToken(), pc2);
    expect(res.receipts.find((r) => r.id === res.new_receipt_id)?.receipt_no).toMatch(/^C2-023-/);
  });

  it("refuses to reissue an earlier day's receipt: the counter reprints it as a DUPLICATE instead", async () => {
    const c = await setup();
    const earlier = await insertPastReceipt(c, { minutesAgo: 26 * 60, mode: 'cash' });
    const day = await c.db.query<{ d: string }>('select business_date::text as d from seva_receipts where id = $1', [earlier]);
    expect(day.rows[0].d < c.today).toBe(true);

    expect(await failure(reissue(c, earlier, qrToken()))).toMatchObject({
      code: 'validation',
      detail: { field: 'reissue_only_today' },
    });
    // Nothing moved: the receipt is still issued, no number was taken and nothing was audited.
    expect(await receiptRow(c.db, earlier)).toMatchObject({ status: 'issued', cancel_reason_code: null });
    expect(await count(c.db, 'seva_receipts')).toBe(1);
    expect(await count(c.db, 'receipt_series_years', `series_code = 'C1' and last_no > 0`)).toBe(0);
    expect(await count(c.db, 'audit_log')).toBe(0);
  });

  it("a same-day reissue keeps today's day close, series ranges and continuity whole: no hole, no double count", async () => {
    const c = await setup();
    // Today at Counter 1: a cash order of two receipts (000001, 000002) and a UPI receipt (000003).
    const order = await issue(c, { days: [1, 2] });
    await issue(c, { days: [1], mode: 'upi' });
    const [spoiled] = order.receipts;
    await prints(c, [spoiled.id]);
    const before = await prepareDayClose(c, c.today);
    expect(before).toMatchObject({ receipts: 3, cancelled: 0, upi_count: 1, upi_expected: '105.00' });

    const res = await reissue(c, spoiled.id, qrToken());
    const fresh = await c.db.query(
      'select business_date::text as business_date, replaces_receipt_id, status, total::text as total from seva_receipts where id = $1',
      [res.new_receipt_id],
    );
    expect(fresh.rows).toEqual([{ business_date: c.today, replaces_receipt_id: spoiled.id, status: 'issued', total: '105.00' }]);

    // The money is counted once: the same issued count, cash and UPI; the spoiled slip shows as cancelled.
    const after = await prepareDayClose(c, c.today);
    expect([after.receipts, after.cancelled, after.cash_expected, after.upi_count, after.upi_expected]).toEqual([
      before.receipts,
      before.cancelled + 1,
      before.cash_expected,
      before.upi_count,
      before.upi_expected,
    ]);
    // Every number from the first to the last of the day is either issued or cancelled, exactly once.
    const prefix = `C1-023-${c.month}-${c.year}/`;
    expect(after.series_ranges).toEqual([
      { series: 'C1', first: `${prefix}000001`, last: `${prefix}000004`, issued: 3, cancelled: 1, open_gaps: 0 },
      { series: 'OF1', first: null, last: null, issued: 0, cancelled: 0, open_gaps: 0 },
    ]);
    const continuity = await asRole(c.db, 'service_role', (d) =>
      d.query('select * from seva_continuity($1::date, $1::date)', [c.today]),
    );
    expect(continuity.rows).toEqual([
      { series_code: 'C1', year: Number(c.year), first_no: 1, last_no: 4, issued: 3, cancelled: 1, open_gaps: 0 },
    ]);
  });
});

describe('rules in SQL, not only in the route (A5-FIX L-5)', () => {
  async function reissueAs(c: Ctx, receiptId: string, staffId: string, isAdmin?: boolean): Promise<OrderResult> {
    return asRole(c.db, 'service_role', async (d) => {
      const r = await d.query<{ r: OrderResult }>(
        isAdmin === undefined
          ? 'select seva_reissue_spoiled($1::uuid, $2::uuid, $3::uuid, $4) as r'
          : 'select seva_reissue_spoiled($1::uuid, $2::uuid, $3::uuid, $4, $5::boolean) as r',
        isAdmin === undefined ? [receiptId, staffId, c.deviceId, qrToken()] : [receiptId, staffId, c.deviceId, qrToken(), isAdmin],
      );
      return r.rows[0].r;
    });
  }

  it("reissue re-checks the person's own receipt and the cancel window; an admin may reissue any", async () => {
    const c = await setup();
    const mine = await issue(c, { days: [1, 2] });
    expect(await failure(reissueAs(c, mine.receipts[0].id, c.sureshId))).toMatchObject({ code: 'forbidden' });
    const old = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });
    expect(await failure(reissueAs(c, old, c.staffId))).toMatchObject({ code: 'cancel_window_passed' });
    expect(await count(c.db, 'seva_receipts', `status = 'cancelled'`)).toBe(0);

    await expect(reissueAs(c, mine.receipts[1].id, c.staffId)).resolves.toMatchObject({
      replaced_receipt_id: mine.receipts[1].id,
    });
    await expect(reissueAs(c, mine.receipts[0].id, c.adminId, true)).resolves.toMatchObject({
      replaced_receipt_id: mine.receipts[0].id,
    });
  });

  it('every admin and office write function refuses a view-only staff id', async () => {
    const c = await setup();
    await c.db.query('update staff set view_only = true where id = $1', [c.adminId]);
    const asViewOnly = (sql: string, params: unknown[]) => asRole(c.db, 'service_role', (d) => d.query(sql, params));
    await expect(
      asViewOnly('select seva_save_denominations($1::jsonb, $2::uuid)', [JSON.stringify([{ kind: 'note', value: 500 }]), c.adminId]),
    ).rejects.toThrow('SEVA:forbidden');
    const order = await issue(c, { days: [0] });
    await expect(
      asViewOnly('select seva_mark_prasadam($1::uuid, $2::uuid, false)', [order.receipts[0].id, c.adminId]),
    ).rejects.toThrow('SEVA:forbidden');
    // The same calls by a writer still work.
    await c.db.query('update staff set view_only = false where id = $1', [c.adminId]);
    await expect(
      asViewOnly('select seva_save_denominations($1::jsonb, $2::uuid)', [JSON.stringify([{ kind: 'note', value: 500 }]), c.adminId]),
    ).resolves.toBeDefined();
  });
});

describe('the PC a cancel was made from (A5-FIX L-4)', () => {
  it('is recorded in the receipt.cancel audit row when the route names it', async () => {
    const c = await setup();
    const order = await issue(c, { days: [1, 2] });
    const [first, second] = order.receipts.map((r) => r.id);
    await asRole(c.db, 'service_role', (d) =>
      d.query(
        `select seva_cancel_receipts($1::uuid[], 'wrong_seva', null, $2::uuid, false, null, null, null, $3::uuid)`,
        [uuidArray([first]), c.staffId, c.deviceId],
      ),
    );
    await cancel(c, { ids: [second], reason: 'wrong_seva' });
    const audit = (await auditRows(c.db)).filter((r) => r.action === 'receipt.cancel');
    expect(audit.map((r) => [r.entity_id, r.after?.device_id])).toEqual([
      [first, c.deviceId],
      [second, undefined],
    ]);
  });
});
