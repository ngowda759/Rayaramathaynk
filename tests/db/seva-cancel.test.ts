/**
 * Database tests for Task A2-1 (part 3 of 3): recording prints and reprints (seva_record_prints), cancelling with a
 * reason and the money-back state (seva_cancel_receipts, C-20, D23) and the spoiled-print reissue
 * (seva_reissue_spoiled, C-21).
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
  p: { days: number[]; mode?: 'cash' | 'upi'; withPaa?: boolean; staffId?: string },
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
      c.deviceId,
    ]);
    return r.rows[0].r;
  });
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

async function cancel(
  c: Ctx,
  p: { ids: string[]; reason: string; note?: string | null; staffId?: string; isAdmin?: boolean; at?: string | null },
): Promise<CancelResult> {
  return asRole(c.db, 'service_role', async (d) => {
    const r = await d.query<{ r: CancelResult }>(
      'select seva_cancel_receipts($1::uuid[], $2, $3, $4::uuid, $5::boolean, $6::timestamptz) as r',
      [uuidArray(p.ids), p.reason, p.note ?? null, p.staffId ?? c.staffId, p.isAdmin ?? false, p.at ?? null],
    );
    return r.rows[0].r;
  });
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
    await expect(cancel(c, { ids: [inside], reason: 'wrong_seva', at: at10 })).resolves.toMatchObject({
      receipts: [{ status: 'cancelled' }],
    });
    expect(await cancelledAt(inside)).toBe(at10);

    const outside = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });
    expect(
      (await failure(cancel(c, { ids: [outside], reason: 'wrong_seva', at: await issuedAt(outside, '31 minutes') }))).code,
    ).toBe('cancel_window_passed');

    // p_at is never earlier than the issue time ...
    const early = await insertPastReceipt(c, { minutesAgo: 40, mode: 'cash' });
    await cancel(c, { ids: [early], reason: 'wrong_seva', at: await issuedAt(early, '-60 minutes') });
    expect(await cancelledAt(early)).toBe(await issuedAt(early, '0 minutes'));

    // ... nor later than now.
    const fresh = await issue(c, { days: [1] });
    await cancel(c, { ids: [fresh.receipts[0].id], reason: 'wrong_seva', at: new Date(Date.now() + 2 * 3600_000).toISOString() });
    expect(await count(c.db, 'seva_receipts', `id = '${fresh.receipts[0].id}' and cancelled_at <= now()`)).toBe(1);
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
});
