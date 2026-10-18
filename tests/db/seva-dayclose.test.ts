import { randomBytes } from 'crypto';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb } from './harness';
import { seedDevice, seedSeva, seedStaff } from './fixtures';

// Day close (DB 9.10, C-24, C-25, D23): seva_prepare_day_close, seva_close_day, seva_reopen_day.
// Fixture: opening float Rs 500; Counter 1 today: cash 610 and 105 (the 105 cancelled), UPI 505; Counter 2: cash 200.

interface SeriesRange {
  series: string;
  first: string | null;
  last: string | null;
  issued: number;
  cancelled: number;
  open_gaps: number;
}

interface Prep {
  counter_id: number;
  business_date: string;
  status: 'open' | 'closed' | 'reopened';
  opening_float: string;
  receipts: number;
  cancelled: number;
  changed: number;
  cash_expected: string;
  upi_count: number;
  upi_expected: string;
  outbox_pending: number;
  series_ranges: SeriesRange[];
  denominations: { kind: 'note' | 'coin'; value: string }[];
}

interface Count {
  kind: 'note' | 'coin';
  value: number;
  count: number;
}

let nextGroup = 1;

async function istToday(db: PGlite): Promise<string> {
  const r = await db.query<{ d: string }>('select business_date::text as d from seva_ist_parts(now())');
  return r.rows[0].d;
}

/** Inserts one receipt (one line) made now, straight into the tables. Returns its receipt number. */
async function insertReceipt(
  db: PGlite,
  p: {
    staffId: string;
    staffNo: number;
    sevaId: string;
    counterId: number;
    series: string;
    mode: 'cash' | 'upi';
    total: string;
    cancelled?: boolean;
    changed?: boolean;
  },
): Promise<string> {
  const cash = p.mode === 'cash';
  const order = await db.query<{ id: string }>(
    `insert into seva_orders (group_no, client_order_id, channel, counter_id, issued_by_staff_id, devotee_name,
                              receipts_count, amount_total, payment_mode, cash_received, change_returned,
                              upi_ref_last6, upi_seen_confirmed, issued_at)
     values ($1, gen_random_uuid(), 'counter', $2::smallint, $3::uuid, 'Venkatesh Rao', 1, $4::numeric, $5,
             case when $6::boolean then $4::numeric end, case when $6::boolean then 0 end,
             case when $6::boolean then null else '123456' end, case when $6::boolean then null else true end, now())
     returning id`,
    [`G-TEST-${nextGroup++}`, p.counterId, p.staffId, p.total, p.mode, cash],
  );
  const receipt = await db.query<{ id: string; receipt_no: string }>(
    `with parts as (select * from seva_ist_parts(now())),
          next as (select coalesce(max(running_no), 0) + 1 as n
                     from seva_receipts, parts where series_code = $1 and seva_receipts.year = parts.year)
     insert into seva_receipts (receipt_no, series_code, year, month, running_no, staff_no, order_id, position,
                                client_receipt_id, seva_date, business_date, total, qr_token, prasadam_state,
                                status, cancel_reason_code, cancelled_at, cancelled_by_staff_id,
                                issued_at, issued_by_staff_id, issued_by_name, issued_offline, has_changed_amount)
     select seva_receipt_no($1, $2::smallint, null, parts.month, parts.year, next.n::int), $1, parts.year,
            parts.month, next.n, $2::smallint, $3::uuid, 1, gen_random_uuid(), parts.business_date,
            parts.business_date, $4::numeric, $5, 'pending',
            case when $6::boolean then 'cancelled' else 'issued' end,
            case when $6::boolean then 'wrong_seva' end,
            case when $6::boolean then now() end,
            case when $6::boolean then $7::uuid end,
            now(), $7::uuid, 'Ramesh', $1 like 'OF%', $8::boolean
       from parts, next
     returning id, receipt_no`,
    [p.series, p.staffNo, order.rows[0].id, p.total, randomBytes(16).toString('base64url'), p.cancelled ?? false,
      p.staffId, p.changed ?? false],
  );
  await db.query(
    `insert into seva_receipt_lines (receipt_id, line_no, seva_id, seva_code, seva_name_en, quantity, catalogue_rate,
                                     unit_rate, amount, change_reason)
     values ($1::uuid, 1, $2::uuid, 'PAN', 'Panchamrita Abhisheka', 1, $3::numeric, $3::numeric, $3::numeric, null)`,
    [receipt.rows[0].id, p.sevaId, p.total],
  );
  return receipt.rows[0].receipt_no;
}

async function prepare(db: PGlite, counterId = 1, date?: string): Promise<Prep> {
  const d = date ?? (await istToday(db));
  const r = await db.query<{ r: Prep }>(`select seva_prepare_day_close($1::smallint, $2::date) as r`, [counterId, d]);
  return r.rows[0].r;
}

async function close(
  db: PGlite,
  staffId: string,
  counts: Count[],
  opts: { upiBankTotal?: string | null; note?: string | null; counterId?: number } = {},
): Promise<string> {
  const r = await db.query<{ id: string }>(
    `select seva_close_day($1::smallint, (select business_date from seva_ist_parts(now())), $2::jsonb,
                           $3::numeric, $4, $5::uuid) as id`,
    [opts.counterId ?? 1, JSON.stringify(counts), opts.upiBankTotal ?? null, opts.note ?? null, staffId],
  );
  return r.rows[0].id;
}

const EXACT: Count[] = [
  { kind: 'note', value: 500, count: 2 },
  { kind: 'coin', value: 10, count: 11 },
];

describe('seva day close functions (A2-2)', () => {
  let db: PGlite;
  let ramesh: string;
  let admin: string;
  let deviceId: string;
  let c1First: string;
  let c1Cancelled: string;
  let c1Upi: string;

  beforeEach(async () => {
    db = await freshDb();
    ramesh = await seedStaff(db, { staffNo: 23, name: 'Ramesh', uid: 'uid-ramesh' });
    admin = await seedStaff(db, { staffNo: 1, name: 'Admin', uid: 'uid-admin' });
    const pan = await seedSeva(db, { code: 'PAN', nameEn: 'Panchamrita Abhisheka', amount: '105.00' });
    await db.query('update counters set opening_float = 500 where id = 1');
    await db.query(`insert into counters (id, name, place) values (2, 'Counter 2', 'Hall')`);
    await db.query(
      `insert into receipt_series (code, kind, counter_id) values ('C2', 'counter_online', 2), ('OF2', 'counter_offline', 2)`,
    );
    deviceId = await seedDevice(db, { staffId: admin });
    await seedDevice(db, { staffId: admin, counterId: 2 });

    const base = { staffId: ramesh, staffNo: 23, sevaId: pan, counterId: 1, series: 'C1' } as const;
    c1First = await insertReceipt(db, { ...base, mode: 'cash', total: '610.00', changed: true });
    c1Cancelled = await insertReceipt(db, { ...base, mode: 'cash', total: '105.00', cancelled: true });
    c1Upi = await insertReceipt(db, { ...base, mode: 'upi', total: '505.00' });
    await insertReceipt(db, { ...base, counterId: 2, series: 'C2', mode: 'cash', total: '200.00' });
  });

  afterEach(async () => {
    await db.close();
  });

  it('prepares expected cash from the float plus this counter\'s issued cash receipts', async () => {
    const prep = await prepare(db);
    expect(prep).toMatchObject({
      counter_id: 1,
      business_date: await istToday(db),
      status: 'open',
      opening_float: '500.00',
      receipts: 2,
      cancelled: 1,
      changed: 1,
      cash_expected: '1110.00',
      upi_count: 1,
      upi_expected: '505.00',
      outbox_pending: 0,
    });
    expect(prep.denominations).toHaveLength(11);
    expect(prep.denominations[0]).toEqual({ kind: 'note', value: '500.00' });
    expect(prep.denominations[10]).toEqual({ kind: 'coin', value: '1.00' });

    const c2 = await prepare(db, 2);
    expect(c2).toMatchObject({ opening_float: '0.00', receipts: 1, cancelled: 0, cash_expected: '200.00', upi_expected: '0.00' });

    await expect(prepare(db, 9)).rejects.toThrow('SEVA:not_found');
  });

  it('needs a note when cash or UPI differs', async () => {
    const short: Count[] = [
      { kind: 'note', value: 500, count: 2 },
      { kind: 'coin', value: 10, count: 10 },
    ];
    await expect(close(db, ramesh, short)).rejects.toThrow('SEVA:difference_note_required');
    await expect(close(db, ramesh, short, { note: 'no' })).rejects.toThrow('SEVA:difference_note_required');
    await expect(close(db, ramesh, EXACT, { upiBankTotal: '500.00' })).rejects.toThrow('SEVA:difference_note_required');

    const id = await close(db, ramesh, short, { note: 'Gave Rs 10 extra change', upiBankTotal: '505.00' });
    const r = await db.query<{ cash_counted: string; cash_difference: string; upi_difference: string; note: string }>(
      `select cash_counted::text, cash_difference::text, upi_difference::text, note from day_closes where id = $1::uuid`,
      [id],
    );
    expect(r.rows[0]).toEqual({
      cash_counted: '1100.00',
      cash_difference: '-10.00',
      upi_difference: '0.00',
      note: 'Gave Rs 10 extra change',
    });
  });

  it('needs an empty outbox', async () => {
    await db.query('update counter_devices set last_outbox_count = 2 where id = $1::uuid', [deviceId]);
    expect((await prepare(db)).outbox_pending).toBe(2);
    await expect(close(db, ramesh, EXACT)).rejects.toThrow('SEVA:outbox_not_empty');
    const n = await db.query<{ n: number }>('select count(*)::int as n from day_closes');
    expect(n.rows[0].n).toBe(0);

    await db.query('update counter_devices set last_outbox_count = 0 where id = $1::uuid', [deviceId]);
    await expect(close(db, ramesh, EXACT)).resolves.toEqual(expect.any(String));
  });

  it('stores counts with snapshot values and generated amounts', async () => {
    const id = await close(db, ramesh, EXACT);
    const counts = await db.query<{ kind: string; value: string; count: number; amount: string }>(
      `select kind, value::text, count, amount::text from day_close_counts where day_close_id = $1::uuid
        order by kind desc, value desc`,
      [id],
    );
    expect(counts.rows).toEqual([
      { kind: 'note', value: '500.00', count: 2, amount: '1000.00' },
      { kind: 'coin', value: '10.00', count: 11, amount: '110.00' },
    ]);

    const row = await db.query<{
      status: string; opening_float: string; receipts_count: number; cancelled_count: number; changed_count: number;
      cash_expected: string; cash_counted: string; cash_difference: string; upi_count: number; upi_expected: string;
      upi_bank_total: string | null; outbox_pending: number; closed_by_staff_id: string; closed_at: string | null;
    }>(
      `select status, opening_float::text, receipts_count, cancelled_count, changed_count, cash_expected::text,
              cash_counted::text, cash_difference::text, upi_count, upi_expected::text, upi_bank_total::text,
              outbox_pending, closed_by_staff_id, closed_at::text
         from day_closes where id = $1::uuid`,
      [id],
    );
    expect(row.rows[0]).toMatchObject({
      status: 'closed',
      opening_float: '500.00',
      receipts_count: 2,
      cancelled_count: 1,
      changed_count: 1,
      cash_expected: '1110.00',
      cash_counted: '1110.00',
      cash_difference: '0.00',
      upi_count: 1,
      upi_expected: '505.00',
      upi_bank_total: null,
      outbox_pending: 0,
      closed_by_staff_id: ramesh,
    });
    expect(row.rows[0].closed_at).not.toBeNull();

    // Values are snapshots: a later change to denominations leaves the stored counts alone.
    await db.query(`update cash_denominations set shown = false where kind = 'coin' and value = 10`);
    const again = await db.query<{ n: number }>(
      `select count(*)::int as n from day_close_counts where day_close_id = $1::uuid and kind = 'coin' and value = 10`,
      [id],
    );
    expect(again.rows[0].n).toBe(1);

    // Bad counts are refused.
    const bad = (counts: unknown) =>
      db.query(
        `select seva_close_day(2::smallint, (select business_date from seva_ist_parts(now())), $1::jsonb, null, null, $2::uuid)`,
        [JSON.stringify(counts), ramesh],
      );
    await expect(bad([{ kind: 'cheque', value: 100, count: 1 }])).rejects.toThrow('SEVA:validation');
    await expect(bad([{ kind: 'note', value: 0, count: 1 }])).rejects.toThrow('SEVA:validation');
    await expect(bad([{ kind: 'note', value: 100, count: -1 }])).rejects.toThrow('SEVA:validation');
    await expect(bad([{ kind: 'note', value: 100, count: 1 }, { kind: 'note', value: 100, count: 1 }])).rejects.toThrow(
      'SEVA:validation',
    );
    await expect(bad({ kind: 'note', value: 100, count: 2 })).rejects.toThrow('SEVA:validation');
  });

  it('allows one close per counter and date, and closing again after a reopen', async () => {
    const id = await close(db, ramesh, EXACT);
    expect((await prepare(db)).status).toBe('closed');
    await expect(close(db, admin, EXACT)).rejects.toThrow('SEVA:day_already_closed');

    await expect(db.query(`select seva_reopen_day($1::uuid, null, $2::uuid)`, [id, admin])).rejects.toThrow(
      'SEVA:validation',
    );
    await expect(db.query(`select seva_reopen_day($1::uuid, ' ', $2::uuid)`, [id, admin])).rejects.toThrow(
      'SEVA:validation',
    );
    await expect(
      db.query(`select seva_reopen_day('00000000-0000-4000-8000-000000000000'::uuid, 'Recount', $1::uuid)`, [admin]),
    ).rejects.toThrow('SEVA:not_found');

    await db.query(`select seva_reopen_day($1::uuid, 'Found a late UPI payment', $2::uuid)`, [id, admin]);
    const reopened = await db.query<{ status: string; reopened_by_staff_id: string; reopen_reason: string }>(
      'select status, reopened_by_staff_id, reopen_reason from day_closes where id = $1::uuid',
      [id],
    );
    expect(reopened.rows[0]).toEqual({
      status: 'reopened',
      reopened_by_staff_id: admin,
      reopen_reason: 'Found a late UPI payment',
    });
    expect((await prepare(db)).status).toBe('reopened');
    await expect(db.query(`select seva_reopen_day($1::uuid, 'Again', $2::uuid)`, [id, admin])).rejects.toThrow(
      'SEVA:validation',
    );

    const recount: Count[] = [
      { kind: 'note', value: 500, count: 2 },
      { kind: 'note', value: 100, count: 1 },
      { kind: 'coin', value: 5, count: 2 },
    ];
    const again = await close(db, admin, recount);
    expect(again).toBe(id);
    const rows = await db.query<{ n: number }>('select count(*)::int as n from day_closes where counter_id = 1');
    expect(rows.rows[0].n).toBe(1);
    const counts = await db.query<{ kind: string; value: string; count: number }>(
      `select kind, value::text, count from day_close_counts where day_close_id = $1::uuid order by kind desc, value desc`,
      [id],
    );
    expect(counts.rows).toEqual([
      { kind: 'note', value: '500.00', count: 2 },
      { kind: 'note', value: '100.00', count: 1 },
      { kind: 'coin', value: '5.00', count: 2 },
    ]);
    const closedBy = await db.query<{ status: string; closed_by_staff_id: string }>(
      'select status, closed_by_staff_id from day_closes where id = $1::uuid',
      [id],
    );
    expect(closedBy.rows[0]).toEqual({ status: 'closed', closed_by_staff_id: admin });

    const audit = await db.query<{ action: string; entity_id: string; actor_staff_id: string; reason: string | null }>(
      `select action, entity_id, actor_staff_id, reason from audit_log where entity = 'day_close' order by id`,
    );
    expect(audit.rows).toEqual([
      { action: 'dayclose.close', entity_id: id, actor_staff_id: ramesh, reason: null },
      { action: 'dayclose.reopen', entity_id: id, actor_staff_id: admin, reason: 'Found a late UPI payment' },
      { action: 'dayclose.close', entity_id: id, actor_staff_id: admin, reason: null },
    ]);
  });

  it('lists series ranges with first, last, issued, cancelled and open gaps', async () => {
    const pan = await db.query<{ id: string }>(`select id from sevas where code = 'PAN'`);
    const of1 = await insertReceipt(db, {
      staffId: ramesh, staffNo: 23, sevaId: pan.rows[0].id, counterId: 1, series: 'OF1', mode: 'cash', total: '105.00',
    });
    await db.query(
      `insert into receipt_series_years (series_code, year, last_no) select 'OF1', year, 4 from seva_ist_parts(now())`,
    );
    await db.query(
      `insert into receipt_number_gaps (series_code, year, from_no, to_no, cause)
       select 'OF1', year, 2, 4, 'missing_in_sync' from seva_ist_parts(now())`,
    );

    const prep = await prepare(db);
    expect(prep.series_ranges).toEqual([
      { series: 'C1', first: c1First, last: c1Upi, issued: 2, cancelled: 1, open_gaps: 0 },
      { series: 'OF1', first: of1, last: of1, issued: 1, cancelled: 0, open_gaps: 1 },
    ]);
    expect(c1Cancelled).toMatch(/^C1-023-\d{2}-\d{4}\/000002$/);
    expect(prep.cash_expected).toBe('1215.00');

    // A counter with nothing today still lists its series.
    await db.query(`insert into counters (id, name) values (3, 'Counter 3')`);
    await db.query(
      `insert into receipt_series (code, kind, counter_id) values ('C3', 'counter_online', 3), ('OF3', 'counter_offline', 3)`,
    );
    const empty = await prepare(db, 3);
    expect(empty.series_ranges).toEqual([
      { series: 'C3', first: null, last: null, issued: 0, cancelled: 0, open_gaps: 0 },
      { series: 'OF3', first: null, last: null, issued: 0, cancelled: 0, open_gaps: 0 },
    ]);
    expect(empty).toMatchObject({ receipts: 0, cash_expected: '0.00', upi_count: 0, outbox_pending: 0 });

    // The stored close keeps the same ranges.
    const id = await close(db, ramesh, [
      { kind: 'note', value: 500, count: 2 },
      { kind: 'note', value: 200, count: 1 },
      { kind: 'coin', value: 5, count: 3 },
    ]);
    const stored = await db.query<{ series_ranges: SeriesRange[] }>(
      'select series_ranges from day_closes where id = $1::uuid',
      [id],
    );
    expect(stored.rows[0].series_ranges).toEqual(prep.series_ranges);
  });
});
