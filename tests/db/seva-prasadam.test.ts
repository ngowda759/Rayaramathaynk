import { randomBytes } from 'crypto';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb } from './harness';
import { seedSeva, seedStaff } from './fixtures';

// Prasadam hand-over (DB 11, C-27, D35): seva_mark_prasadam and seva_undo_prasadam.

interface MarkResult {
  state: 'given' | 'already_given' | 'needs_confirm' | 'cancelled' | 'no_prasadam';
  off_date?: 'before' | 'after';
  days?: number;
  given_at?: string;
  given_by_name?: string;
}

interface ReceiptRow {
  prasadam_state: string;
  prasadam_given_at: string | null;
  prasadam_given_by_staff_id: string | null;
  prasadam_off_date: string | null;
}

let nextGroup = 1;

async function istDate(db: PGlite, offsetDays = 0): Promise<string> {
  const r = await db.query<{ d: string }>(
    `select (business_date + $1::int)::text as d from seva_ist_parts(now())`,
    [offsetDays],
  );
  return r.rows[0].d;
}

/** Inserts one issued cash receipt (one line) made now on Counter 1, straight into the tables. */
async function insertReceipt(
  db: PGlite,
  p: {
    staffId: string;
    staffNo: number;
    sevaId: string;
    sevaDate: string;
    prasadam: 'none' | 'pending';
    cancelled?: boolean;
  },
): Promise<string> {
  const order = await db.query<{ id: string }>(
    `insert into seva_orders (group_no, client_order_id, channel, counter_id, issued_by_staff_id, devotee_name,
                              receipts_count, amount_total, payment_mode, cash_received, change_returned, issued_at)
     values ($1, gen_random_uuid(), 'counter', 1, $2::uuid, 'Venkatesh Rao', 1, 105, 'cash', 105, 0, now())
     returning id`,
    [`G-TEST-${nextGroup++}`, p.staffId],
  );
  const orderId = order.rows[0].id;
  const receipt = await db.query<{ id: string }>(
    `with parts as (select * from seva_ist_parts(now())),
          next as (select coalesce(max(running_no), 0) + 1 as n
                     from seva_receipts, parts where series_code = 'C1' and seva_receipts.year = parts.year)
     insert into seva_receipts (receipt_no, series_code, year, month, running_no, staff_no, order_id, position,
                                client_receipt_id, seva_date, business_date, total, qr_token, prasadam_state,
                                status, cancel_reason_code, cancelled_at, cancelled_by_staff_id,
                                issued_at, issued_by_staff_id, issued_by_name)
     select seva_receipt_no('C1', $1::smallint, null, parts.month, parts.year, next.n::int), 'C1', parts.year,
            parts.month, next.n, $1::smallint, $2::uuid, 1, gen_random_uuid(), $3::date, parts.business_date, 105,
            $4, $5,
            case when $6::boolean then 'cancelled' else 'issued' end,
            case when $6::boolean then 'wrong_seva' end,
            case when $6::boolean then now() end,
            case when $6::boolean then $7::uuid end,
            now(), $7::uuid, 'Ramesh'
       from parts, next
     returning id`,
    [p.staffNo, orderId, p.sevaDate, randomBytes(16).toString('base64url'), p.prasadam, p.cancelled ?? false, p.staffId],
  );
  const receiptId = receipt.rows[0].id;
  await db.query(
    `insert into seva_receipt_lines (receipt_id, line_no, seva_id, seva_code, seva_name_en, quantity, catalogue_rate,
                                     unit_rate, amount)
     values ($1::uuid, 1, $2::uuid, 'PAN', 'Panchamrita Abhisheka', 1, 105, 105, 105)`,
    [receiptId, p.sevaId],
  );
  return receiptId;
}

async function mark(db: PGlite, receiptId: string, staffId: string, confirm: boolean): Promise<MarkResult> {
  const r = await db.query<{ r: MarkResult }>(`select seva_mark_prasadam($1::uuid, $2::uuid, $3::boolean) as r`, [
    receiptId,
    staffId,
    confirm,
  ]);
  return r.rows[0].r;
}

async function undo(
  db: PGlite,
  receiptId: string,
  staffId: string,
  reason: string | null,
  isAdmin = false,
): Promise<{ state: string }> {
  const r = await db.query<{ r: { state: string } }>(
    `select seva_undo_prasadam($1::uuid, $2::uuid, $3, $4::boolean) as r`,
    [receiptId, staffId, reason, isAdmin],
  );
  return r.rows[0].r;
}

async function receiptRow(db: PGlite, id: string): Promise<ReceiptRow> {
  const r = await db.query<ReceiptRow>(
    `select prasadam_state, prasadam_given_at::text, prasadam_given_by_staff_id, prasadam_off_date
       from seva_receipts where id = $1::uuid`,
    [id],
  );
  return r.rows[0];
}

async function auditActions(db: PGlite, receiptId: string): Promise<{ action: string; reason: string | null }[]> {
  const r = await db.query<{ action: string; reason: string | null }>(
    `select action, reason from audit_log where entity = 'receipt' and entity_id = $1 order by id`,
    [receiptId],
  );
  return r.rows;
}

describe('seva prasadam functions (A2-2)', () => {
  let db: PGlite;
  let ramesh: string;
  let suresh: string;
  let ganesh: string;
  let admin: string;
  let pan: string;
  let paa: string;

  beforeEach(async () => {
    db = await freshDb();
    ramesh = await seedStaff(db, { staffNo: 23, name: 'Ramesh', uid: 'uid-ramesh' });
    suresh = await seedStaff(db, { staffNo: 31, name: 'Suresh', uid: 'uid-suresh' });
    ganesh = await seedStaff(db, { staffNo: 32, name: 'Ganesh', uid: 'uid-ganesh' });
    admin = await seedStaff(db, { staffNo: 1, name: 'Admin', uid: 'uid-admin' });
    pan = await seedSeva(db, { code: 'PAN', nameEn: 'Panchamrita Abhisheka', amount: '105.00', prasadamGiven: true });
    paa = await seedSeva(db, { code: 'PAA', nameEn: 'Paaduka Pooja', amount: '505.00', prasadamGiven: false });
  });

  afterEach(async () => {
    await db.close();
  });

  it('marks prasadam once and reports who gave it', async () => {
    const id = await insertReceipt(db, { staffId: ramesh, staffNo: 23, sevaId: pan, sevaDate: await istDate(db), prasadam: 'pending' });

    const first = await mark(db, id, suresh, false);
    expect(first.state).toBe('given');
    expect(first.given_by_name).toBe('Suresh');
    expect(first.given_at).toEqual(expect.any(String));
    expect(first.off_date).toBeUndefined();

    const row = await receiptRow(db, id);
    expect(row.prasadam_state).toBe('given');
    expect(row.prasadam_given_by_staff_id).toBe(suresh);
    expect(row.prasadam_off_date).toBeNull();

    const second = await mark(db, id, ganesh, false);
    expect(second.state).toBe('already_given');
    expect(second.given_by_name).toBe('Suresh');
    expect(new Date(String(second.given_at)).getTime()).toBe(new Date(String(first.given_at)).getTime());
    expect((await receiptRow(db, id)).prasadam_given_by_staff_id).toBe(suresh);

    // A give on the seva date itself writes no audit row.
    expect(await auditActions(db, id)).toEqual([]);
  });

  it('needs a second tap before or after the seva date and records which', async () => {
    const early = await insertReceipt(db, {
      staffId: ramesh, staffNo: 23, sevaId: pan, sevaDate: await istDate(db, 2), prasadam: 'pending',
    });
    expect(await mark(db, early, suresh, false)).toEqual({ state: 'needs_confirm', off_date: 'before', days: 2 });
    expect((await receiptRow(db, early)).prasadam_state).toBe('pending');

    const given = await mark(db, early, suresh, true);
    expect(given).toMatchObject({ state: 'given', off_date: 'before', days: 2, given_by_name: 'Suresh' });
    const row = await receiptRow(db, early);
    expect(row.prasadam_state).toBe('given');
    expect(row.prasadam_off_date).toBe('before');
    expect(await auditActions(db, early)).toEqual([{ action: 'prasadam.given_off_date', reason: null }]);

    const late = await insertReceipt(db, {
      staffId: ramesh, staffNo: 23, sevaId: pan, sevaDate: await istDate(db, -1), prasadam: 'pending',
    });
    expect(await mark(db, late, suresh, false)).toEqual({ state: 'needs_confirm', off_date: 'after', days: 1 });
    expect(await mark(db, late, suresh, true)).toMatchObject({ state: 'given', off_date: 'after', days: 1 });
    expect((await receiptRow(db, late)).prasadam_off_date).toBe('after');
  });

  it('refuses cancelled receipts and receipts without prasadam', async () => {
    const today = await istDate(db);
    const cancelled = await insertReceipt(db, {
      staffId: ramesh, staffNo: 23, sevaId: pan, sevaDate: today, prasadam: 'pending', cancelled: true,
    });
    const none = await insertReceipt(db, { staffId: ramesh, staffNo: 23, sevaId: paa, sevaDate: today, prasadam: 'none' });

    expect(await mark(db, cancelled, suresh, true)).toEqual({ state: 'cancelled' });
    expect((await receiptRow(db, cancelled)).prasadam_state).toBe('pending');
    expect(await mark(db, none, suresh, true)).toEqual({ state: 'no_prasadam' });
    expect((await receiptRow(db, none)).prasadam_state).toBe('none');

    await expect(mark(db, '00000000-0000-4000-8000-000000000000', suresh, false)).rejects.toThrow('SEVA:not_found');
    await db.query(`update staff set status = 'inactive', status_reason = 'Left' where id = $1::uuid`, [ganesh]);
    await expect(mark(db, none, ganesh, false)).rejects.toThrow('SEVA:staff_inactive');
  });

  it('undoes by the same person within the undo time', async () => {
    const id = await insertReceipt(db, { staffId: ramesh, staffNo: 23, sevaId: pan, sevaDate: await istDate(db), prasadam: 'pending' });
    await mark(db, id, suresh, false);

    // Someone else cannot undo it, even inside the undo time.
    await expect(undo(db, id, ganesh, null)).rejects.toThrow('SEVA:forbidden');

    expect(await undo(db, id, suresh, null)).toEqual({ state: 'pending' });
    expect(await receiptRow(db, id)).toEqual({
      prasadam_state: 'pending',
      prasadam_given_at: null,
      prasadam_given_by_staff_id: null,
      prasadam_off_date: null,
    });
    expect(await auditActions(db, id)).toEqual([{ action: 'prasadam.undo', reason: null }]);

    // Nothing left to undo.
    await expect(undo(db, id, suresh, null)).rejects.toThrow('SEVA:validation');
  });

  it('after the undo time needs an admin and a reason', async () => {
    await db.query('update seva_settings set prasadam_undo_seconds = 0 where id = 1');
    const id = await insertReceipt(db, { staffId: ramesh, staffNo: 23, sevaId: pan, sevaDate: await istDate(db), prasadam: 'pending' });
    await mark(db, id, suresh, false);

    await expect(undo(db, id, suresh, 'Mistap')).rejects.toThrow('SEVA:forbidden');
    await expect(undo(db, id, admin, null, true)).rejects.toThrow('SEVA:validation');
    await expect(undo(db, id, admin, '  ', true)).rejects.toThrow('SEVA:validation');
    expect((await receiptRow(db, id)).prasadam_state).toBe('given');

    expect(await undo(db, id, admin, 'Devotee did not take it', true)).toEqual({ state: 'pending' });
    expect((await receiptRow(db, id)).prasadam_state).toBe('pending');
    const audits = await auditActions(db, id);
    expect(audits).toEqual([{ action: 'prasadam.reversed', reason: 'Devotee did not take it' }]);
  });
});
