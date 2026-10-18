/**
 * Task A2-3 - dashboard, needs attention, continuity, seva summary and festival report
 * (supabase/migrations/20261021000200_seva_functions_admin.sql).
 *
 * Receipts are written straight into the tables as the owner (the issue functions belong to Task A2-1), with fixed
 * instants so IST buckets are exact. The report functions are called as service_role.
 *
 * The business day used throughout is Sunday 18 October 2026 (IST): it runs from 2026-10-17T18:30:00Z to
 * 2026-10-18T18:30:00Z.
 */
import { randomBytes } from 'crypto';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, freshDb } from './harness';
import { seedDevice, seedSeva, seedStaff } from './fixtures';

type Row = Record<string, unknown>;

const DAY_FROM = '2026-10-17T18:30:00Z';
const DAY_TO = '2026-10-18T18:30:00Z';
const PREV_FROM = '2026-10-16T18:30:00Z';
const PREV_TO = '2026-10-17T18:30:00Z';
const TODAY = '2026-10-18';

async function svc<T extends Row = Row>(db: PGlite, sql: string, params: unknown[] = []): Promise<T[]> {
  return asRole(db, 'service_role', async (d) => (await d.query<T>(sql, params)).rows);
}

/** IST year, month and date of an ISO instant. */
function ist(iso: string): { year: number; month: number; date: string } {
  const local = new Date(new Date(iso).getTime() + 330 * 60 * 1000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    date: local.toISOString().slice(0, 10),
  };
}

interface LineSpec {
  sevaId: string;
  qty?: number;
  unit: string;
  catalogue?: string | null;
  reason?: string;
}

interface ReceiptSpec {
  lines: LineSpec[];
  status?: 'issued' | 'cancelled';
  cancelledAt?: string;
  refund?: 'none' | 'due' | 'done';
  sevaDate?: string;
  prasadam?: 'none' | 'pending' | 'given';
  changed?: boolean;
}

interface OrderSpec {
  issuedAt: string;
  mode: 'cash' | 'upi' | 'online';
  series?: 'C1' | 'C2' | 'OF1' | 'W' | 'WT';
  counterId?: number;
  testMode?: boolean;
  receivedAt?: string;
  supersedes?: string;
  receipts: ReceiptSpec[];
}

class Fixture {
  private running = new Map<string, number>();
  private group = 0;

  constructor(
    private db: PGlite,
    private staff: { id: string; staffNo: number },
  ) {}

  async order(spec: OrderSpec): Promise<{ orderId: string; receiptIds: string[] }> {
    const series = spec.series ?? (spec.mode === 'online' ? 'W' : 'C1');
    const online = series === 'W' || series === 'WT';
    const offline = series.startsWith('OF');
    const counterId = online ? null : (spec.counterId ?? Number(series.replace(/\D/g, '')));
    const parts = ist(spec.issuedAt);
    const totals = spec.receipts.map((r) =>
      r.lines.reduce((sum, l) => sum + (l.qty ?? 1) * Number(l.unit), 0),
    );
    const orderTotal = totals.reduce((a, b) => a + b, 0);
    this.group += 1;
    const order = await this.db.query<{ id: string }>(
      `insert into seva_orders (group_no, client_order_id, channel, counter_id, issued_by_staff_id, devotee_name,
                                receipts_count, amount_total, payment_mode, upi_ref_last6, upi_seen_confirmed,
                                payment_order_id, issued_offline, supersedes_order_id, test_mode, issued_at, received_at)
       values ($1, gen_random_uuid(), $2, $3::smallint, $4::uuid, 'Venkatesh Rao', $5::smallint, $6::numeric, $7,
               $8, $9::boolean, $10::uuid, $11::boolean, $12::uuid, $13::boolean, $14::timestamptz,
               coalesce($15::timestamptz, $14::timestamptz))
       returning id`,
      [
        `G-TEST-${String(this.group).padStart(4, '0')}`,
        online ? 'web' : 'counter',
        counterId,
        online ? null : this.staff.id,
        spec.receipts.length,
        orderTotal.toFixed(2),
        spec.mode,
        spec.mode === 'upi' ? '123456' : null,
        spec.mode === 'upi' ? true : null,
        spec.mode === 'online' ? '11111111-1111-4111-8111-111111111111' : null,
        offline,
        spec.supersedes ?? null,
        spec.testMode ?? false,
        spec.issuedAt,
        spec.receivedAt ?? null,
      ],
    );
    const orderId = order.rows[0].id;
    const receiptIds: string[] = [];
    for (const [i, r] of spec.receipts.entries()) {
      const key = `${series}:${parts.year}`;
      const runningNo = (this.running.get(key) ?? 0) + 1;
      this.running.set(key, runningNo);
      const middle = online ? 'WEB' : String(this.staff.staffNo).padStart(3, '0');
      const receiptNo = `${series}-${middle}-${String(parts.month).padStart(2, '0')}-${parts.year}/${String(runningNo).padStart(6, '0')}`;
      const cancelled = r.status === 'cancelled';
      const rec = await this.db.query<{ id: string }>(
        `insert into seva_receipts (receipt_no, series_code, year, month, running_no, staff_no, order_id, position,
                                    client_receipt_id, seva_date, business_date, total, status, cancel_reason_code,
                                    cancelled_at, cancelled_by_staff_id, refund_state, qr_token, prasadam_state,
                                    prasadam_given_at, issued_at, issued_by_staff_id, issued_by_name, issued_offline,
                                    has_changed_amount, test_mode)
         values ($1, $2, $3::smallint, $4::smallint, $5::int, $6::smallint, $7::uuid, $8::smallint, gen_random_uuid(),
                 $9::date, $10::date, $11::numeric, $12, $13, $14::timestamptz, $15::uuid, $16, $17, $18,
                 $19::timestamptz, $20::timestamptz, $21::uuid, $22, $23::boolean, $24::boolean, $25::boolean)
         returning id`,
        [
          receiptNo,
          series,
          parts.year,
          parts.month,
          runningNo,
          online ? null : this.staff.staffNo,
          orderId,
          i + 1,
          r.sevaDate ?? parts.date,
          parts.date,
          totals[i].toFixed(2),
          cancelled ? 'cancelled' : 'issued',
          cancelled ? 'wrong_seva' : null,
          cancelled ? (r.cancelledAt ?? spec.issuedAt) : null,
          cancelled ? this.staff.id : null,
          r.refund ?? 'none',
          randomBytes(16).toString('base64url'),
          r.prasadam ?? 'none',
          r.prasadam === 'given' ? spec.issuedAt : null,
          spec.issuedAt,
          online ? null : this.staff.id,
          online ? null : 'Ramesh',
          offline,
          r.changed ?? false,
          spec.testMode ?? false,
        ],
      );
      const receiptId = rec.rows[0].id;
      receiptIds.push(receiptId);
      for (const [n, l] of r.lines.entries()) {
        const qty = l.qty ?? 1;
        await this.db.query(
          `insert into seva_receipt_lines (receipt_id, line_no, seva_id, seva_name_en, quantity, catalogue_rate,
                                           unit_rate, amount, change_reason)
           values ($1::uuid, $2::smallint, $3::uuid, 'Seva', $4::smallint, $5::numeric, $6::numeric, $7::numeric, $8)`,
          [
            receiptId,
            n + 1,
            l.sevaId,
            qty,
            l.catalogue === undefined ? l.unit : l.catalogue,
            l.unit,
            (qty * Number(l.unit)).toFixed(2),
            l.reason ?? null,
          ],
        );
      }
    }
    return { orderId, receiptIds };
  }
}

async function setup(): Promise<{
  db: PGlite;
  fx: Fixture;
  staffId: string;
  sevas: Record<'PAN' | 'PAA' | 'TUL' | 'GHI', string>;
}> {
  const db = await freshDb();
  const staffId = await seedStaff(db, { staffNo: 23, name: 'Ramesh', uid: 'uid-ramesh' });
  const sevas = {
    PAN: await seedSeva(db, { code: 'PAN', nameEn: 'Panchamrita Abhisheka', amount: '105.00' }),
    PAA: await seedSeva(db, { code: 'PAA', nameEn: 'Paaduka Pooja', amount: '505.00' }),
    TUL: await seedSeva(db, { code: 'TUL', nameEn: 'Tulasi Archane', amount: '100.00' }),
    GHI: await seedSeva(db, { code: 'GHI', nameEn: 'Ghee Deepa', amount: '1000.00' }),
  };
  return { db, fx: new Fixture(db, { id: staffId, staffNo: 23 }), staffId, sevas };
}

type Card = { id: string; level: string; count: number; detail: Record<string, string | number> };

async function attention(db: PGlite, from = DAY_FROM, to = DAY_TO, today = TODAY): Promise<Card[]> {
  const [{ cards }] = await svc<{ cards: Card[] }>(
    db,
    `select seva_needs_attention($1::timestamptz, $2::timestamptz, $3::date) as cards`,
    [from, to, today],
  );
  return cards;
}

function card(cards: Card[], id: string): Card {
  const found = cards.find((c) => c.id === id);
  if (!found) throw new Error(`card ${id} missing`);
  return found;
}

async function addGoodBackup(db: PGlite): Promise<void> {
  await db.query(
    `insert into ops_backup_runs (started_at, finished_at, ok, bytes, sha256)
     values (now() - interval '2 hours', now() - interval '2 hours' + interval '1 minute', true, 1024, 'abc')`,
  );
}

describe('seva dashboard (A2-3)', () => {
  let db: PGlite;
  let fx: Fixture;
  let sevas: Awaited<ReturnType<typeof setup>>['sevas'];

  async function dashboard(from: string, to: string, prevFrom: string | null, prevTo: string | null, bucket: string): Promise<Row> {
    const [{ d }] = await svc<{ d: Row }>(
      db,
      `select seva_dashboard($1::timestamptz, $2::timestamptz, $3::timestamptz, $4::timestamptz, $5) as d`,
      [from, to, prevFrom, prevTo, bucket],
    );
    return d;
  }

  beforeAll(async () => {
    ({ db, fx, sevas } = await setup());
    // Today: cash 610 (10:30 IST), cash 105 cancelled (11:30), UPI 505 (14:10), one test-mode 1000 (online, WT).
    await fx.order({
      issuedAt: '2026-10-18T05:00:00Z',
      mode: 'cash',
      receipts: [{ lines: [{ sevaId: sevas.PAA, unit: '505.00' }, { sevaId: sevas.PAN, unit: '105.00' }] }],
    });
    await fx.order({
      issuedAt: '2026-10-18T06:00:00Z',
      mode: 'cash',
      receipts: [{ status: 'cancelled', lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
    });
    await fx.order({
      issuedAt: '2026-10-18T08:40:00Z',
      mode: 'upi',
      receipts: [{ lines: [{ sevaId: sevas.PAA, unit: '505.00' }] }],
    });
    await fx.order({
      issuedAt: '2026-10-18T09:00:00Z',
      mode: 'online',
      series: 'WT',
      testMode: true,
      receipts: [{ lines: [{ sevaId: sevas.GHI, unit: '1000.00' }] }],
    });
    // Yesterday 10:00 IST: cash 200.
    await fx.order({
      issuedAt: '2026-10-17T04:30:00Z',
      mode: 'cash',
      receipts: [{ lines: [{ sevaId: sevas.TUL, qty: 2, unit: '100.00' }] }],
    });
    await db.query(
      `with f as (insert into festival_days (name_en) values ('Deepavali') returning id)
       insert into festival_day_dates (festival_id, day) select id, '2026-10-18' from f`,
    );
  });

  afterAll(async () => {
    await db.close();
  });

  it('dashboard totals exclude cancelled and test-mode receipts', async () => {
    const d = await dashboard(DAY_FROM, DAY_TO, null, null, 'hour');
    expect(d.tiles).toEqual({ total: '1115.00', receipts: 2, cash: '610.00', upi: '505.00', online: '0.00', prev: null });
    expect(d.mode).toEqual({ cash: '610.00', upi: '505.00', online: '0.00' });
    expect(d.calendar).toEqual([{ date: TODAY, total: '1115.00' }]);
    expect(d.festival_dates).toEqual([TODAY]);
    expect(typeof d.as_of).toBe('string');
  });

  it('uses the previous span given by the caller', async () => {
    const d = await dashboard(DAY_FROM, DAY_TO, PREV_FROM, PREV_TO, 'hour');
    expect((d.tiles as Row).prev).toEqual({ total: '200.00', receipts: 1, cash: '200.00', upi: '0.00', online: '0.00' });
    const prev = (d.hero as { prev: { key: string; total: string }[] }).prev;
    expect(prev.find((p) => p.key === '2026-10-18 10:00')).toEqual({ key: '2026-10-18 10:00', total: '200.00' });
    expect(prev.filter((p) => p.total !== '0.00')).toHaveLength(1);
    // A previous span that holds nothing gives zero totals, not null.
    const empty = await dashboard(DAY_FROM, DAY_TO, '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z', 'hour');
    expect((empty.tiles as Row).prev).toEqual({ total: '0.00', receipts: 0, cash: '0.00', upi: '0.00', online: '0.00' });
  });

  it('buckets by IST hour, day or month', async () => {
    type Bucket = { key: string; label: string; cash: string; upi: string; online: string };
    const hours = (await dashboard(DAY_FROM, DAY_TO, null, null, 'hour')).hero as { buckets: Bucket[]; prev: unknown[] };
    expect(hours.buckets).toHaveLength(18);
    expect(hours.buckets[0]).toEqual({ key: '2026-10-18 05:00', label: '05:00', cash: '0.00', upi: '0.00', online: '0.00' });
    expect(hours.buckets[17].key).toBe('2026-10-18 22:00');
    expect(hours.buckets.find((b) => b.key === '2026-10-18 10:00')).toMatchObject({ cash: '610.00', upi: '0.00' });
    expect(hours.buckets.find((b) => b.key === '2026-10-18 14:00')).toMatchObject({ cash: '0.00', upi: '505.00' });
    expect(hours.prev).toEqual([]);

    // Week Monday 12 Oct to the end of Sunday 18 Oct (IST).
    const days = (await dashboard('2026-10-11T18:30:00Z', DAY_TO, null, null, 'day')).hero as { buckets: Bucket[] };
    expect(days.buckets.map((b) => b.key)).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
    ]);
    expect(days.buckets[5]).toEqual({ key: '2026-10-17', label: '17 Oct', cash: '200.00', upi: '0.00', online: '0.00' });
    expect(days.buckets[6]).toMatchObject({ cash: '610.00', upi: '505.00' });

    const months = (await dashboard('2025-12-31T18:30:00Z', '2026-12-31T18:30:00Z', null, null, 'month')).hero as {
      buckets: Bucket[];
    };
    expect(months.buckets).toHaveLength(12);
    expect(months.buckets[9]).toEqual({ key: '2026-10', label: 'Oct', cash: '810.00', upi: '505.00', online: '0.00' });

    await expect(dashboard(DAY_FROM, DAY_TO, null, null, 'week')).rejects.toThrow(/SEVA:validation/);
    await expect(dashboard(DAY_TO, DAY_FROM, null, null, 'hour')).rejects.toThrow(/SEVA:validation/);
  });

  it('ranks top sevas by the amount actually paid', async () => {
    const d = await dashboard(DAY_FROM, DAY_TO, PREV_FROM, PREV_TO, 'hour');
    expect(d.top_sevas).toEqual([
      { seva_id: sevas.PAA, name_en: 'Paaduka Pooja', name_kn: null, amount: '1010.00', quantity: 2, prev_amount: '0.00' },
      { seva_id: sevas.PAN, name_en: 'Panchamrita Abhisheka', name_kn: null, amount: '105.00', quantity: 1, prev_amount: '0.00' },
    ]);

    // 20 Oct: Ghee Deepa (catalogue 1000) given for 100 with a reason; Panchamrita 3 x 105 = 315 ranks first.
    await fx.order({
      issuedAt: '2026-10-20T05:00:00Z',
      mode: 'cash',
      receipts: [
        {
          changed: true,
          lines: [
            { sevaId: sevas.GHI, unit: '100.00', catalogue: '1000.00', reason: 'Devotee offered less' },
            { sevaId: sevas.PAN, qty: 3, unit: '105.00' },
          ],
        },
      ],
    });
    const later = await dashboard('2026-10-19T18:30:00Z', '2026-10-20T18:30:00Z', null, null, 'hour');
    expect((later.top_sevas as Row[]).map((t) => [t.seva_id, t.amount, t.quantity])).toEqual([
      [sevas.PAN, '315.00', 3],
      [sevas.GHI, '100.00', 1],
    ]);
  });

  it('counts counter rush by IST weekday and hour', async () => {
    const d = await dashboard(DAY_FROM, DAY_TO, null, null, 'hour');
    // Sunday is ISO weekday 7; the cancelled 11:30 receipt and the online test receipt are not counted.
    expect(d.rush).toEqual([
      { dow: 7, hour: 10, count: 1 },
      { dow: 7, hour: 14, count: 1 },
    ]);
  });
});

describe('seva needs attention (A2-3)', () => {
  let db: PGlite;
  let fx: Fixture;
  let staffId: string;
  let sevas: Awaited<ReturnType<typeof setup>>['sevas'];

  beforeEach(async () => {
    ({ db, fx, staffId, sevas } = await setup());
    await addGoodBackup(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it('shows calm zero cards when nothing is wrong', async () => {
    const cards = await attention(db);
    expect(cards.map((c) => c.id)).toEqual([
      'changed_amounts', 'cancellations', 'day_close_difference', 'day_not_closed', 'waiting_to_sync', 'number_gaps',
      'prasadam_pending', 'upi_refunds_due', 'clock_skew', 'backup', 'database_size', 'in_doubt_duplicates',
      'future_offline',
    ]);
    for (const c of cards) {
      expect({ id: c.id, level: c.level, count: c.count }).toEqual({ id: c.id, level: 'ok', count: 0 });
    }
  });

  const fixtures: Record<string, { level: string; count: number; build: () => Promise<void>; detail?: Row }> = {
    changed_amounts: {
      level: 'attention',
      count: 1,
      build: async () => {
        await fx.order({
          issuedAt: '2026-10-18T05:00:00Z',
          mode: 'cash',
          receipts: [{ changed: true, lines: [{ sevaId: sevas.PAN, unit: '150.00', catalogue: '105.00', reason: 'Devotee offered more' }] }],
        });
        await fx.order({ issuedAt: '2026-10-18T05:10:00Z', mode: 'cash', receipts: [{ lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }] });
      },
    },
    cancellations: {
      level: 'attention',
      count: 2,
      detail: { after_window: 1 },
      build: async () => {
        await fx.order({
          issuedAt: '2026-10-18T05:00:00Z',
          mode: 'cash',
          receipts: [{ status: 'cancelled', cancelledAt: '2026-10-18T05:10:00Z', lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
        });
        await fx.order({
          issuedAt: '2026-10-18T05:00:00Z',
          mode: 'cash',
          receipts: [{ status: 'cancelled', cancelledAt: '2026-10-18T07:00:00Z', lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
        });
      },
    },
    number_gaps: {
      level: 'critical',
      count: 1,
      detail: { missing_numbers: 2 },
      build: async () => {
        await db.query(`insert into receipt_series_years (series_code, year, last_no) values ('OF1', 2026, 9)`);
        await db.query(
          `insert into receipt_number_gaps (series_code, year, from_no, to_no, cause) values ('OF1', 2026, 4, 5, 'missing_in_sync')`,
        );
        await db.query(
          `insert into receipt_number_gaps (series_code, year, from_no, to_no, cause, status, resolution_note)
           values ('OF1', 2026, 7, 7, 'missing_in_sync', 'declared_lost', 'Slip torn')`,
        );
      },
    },
    day_not_closed: {
      level: 'critical',
      count: 1,
      detail: { oldest_date: '2026-10-17' },
      build: async () => {
        // 16 Oct closed, 17 Oct not closed, today (18 Oct) not counted yet.
        await fx.order({ issuedAt: '2026-10-16T05:00:00Z', mode: 'cash', receipts: [{ lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }] });
        await fx.order({ issuedAt: '2026-10-17T05:00:00Z', mode: 'cash', receipts: [{ lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }] });
        await fx.order({ issuedAt: '2026-10-18T05:00:00Z', mode: 'cash', receipts: [{ lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }] });
        await db.query(
          `insert into day_closes (counter_id, business_date, cash_expected, cash_counted, series_ranges, outbox_pending,
                                   closed_by_staff_id, closed_at)
           values (1, '2026-10-16', 105, 105, '[]', 0, $1::uuid, now())`,
          [staffId],
        );
      },
    },
    waiting_to_sync: {
      level: 'attention',
      count: 1,
      detail: { outbox: 3 },
      build: async () => {
        const device = await seedDevice(db, { staffId });
        await db.query(`update counter_devices set last_outbox_count = 3, last_seen_at = now() where id = $1`, [device]);
      },
    },
    clock_skew: {
      level: 'attention',
      count: 1,
      build: async () => {
        const device = await seedDevice(db, { staffId });
        await db.query(`update counter_devices set last_clock_skew_ms = -180000, last_seen_at = now() where id = $1`, [device]);
      },
    },
    backup: {
      level: 'critical',
      count: 1,
      detail: { reason: 'failed' },
      build: async () => {
        await db.query(
          `insert into ops_backup_runs (started_at, finished_at, ok, error) values (now() - interval '1 hour', now(), false, 'upload failed')`,
        );
      },
    },
    prasadam_pending: {
      level: 'attention',
      count: 1,
      detail: { today: 1, past: 0, oldest_today: '14:10' },
      build: async () => {
        await fx.order({
          issuedAt: '2026-10-18T08:40:00Z',
          mode: 'cash',
          receipts: [{ prasadam: 'pending', lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
        });
        await fx.order({
          issuedAt: '2026-10-18T09:40:00Z',
          mode: 'cash',
          receipts: [{ prasadam: 'given', lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
        });
        // Booked for a later date: not pending today.
        await fx.order({
          issuedAt: '2026-10-18T09:50:00Z',
          mode: 'cash',
          receipts: [{ prasadam: 'pending', sevaDate: '2026-10-25', lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
        });
      },
    },
    upi_refunds_due: {
      level: 'attention',
      count: 1,
      detail: { amount: '505.00' },
      build: async () => {
        await fx.order({
          issuedAt: '2026-10-18T05:00:00Z',
          mode: 'upi',
          receipts: [{ status: 'cancelled', refund: 'due', lines: [{ sevaId: sevas.PAA, unit: '505.00' }] }],
        });
        await fx.order({
          issuedAt: '2026-10-18T05:00:00Z',
          mode: 'cash',
          receipts: [{ status: 'cancelled', refund: 'done', lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
        });
      },
    },
    in_doubt_duplicates: {
      level: 'attention',
      count: 1,
      build: async () => {
        const c = await fx.order({ issuedAt: '2026-10-18T05:00:00Z', mode: 'cash', receipts: [{ lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }] });
        await fx.order({
          issuedAt: '2026-10-18T05:01:00Z',
          mode: 'cash',
          series: 'OF1',
          supersedes: c.orderId,
          receipts: [{ lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
        });
        // A superseded order whose receipts were all cancelled is settled.
        const settled = await fx.order({
          issuedAt: '2026-10-18T06:00:00Z',
          mode: 'cash',
          receipts: [{ status: 'cancelled', lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
        });
        await fx.order({
          issuedAt: '2026-10-18T06:01:00Z',
          mode: 'cash',
          series: 'OF1',
          supersedes: settled.orderId,
          receipts: [{ lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
        });
      },
    },
    future_offline: {
      level: 'attention',
      count: 1,
      build: async () => {
        await fx.order({
          issuedAt: '2026-10-18T05:10:00Z',
          receivedAt: '2026-10-18T05:05:00Z',
          mode: 'cash',
          series: 'OF1',
          receipts: [{ lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
        });
        // One minute ahead is within tolerance.
        await fx.order({
          issuedAt: '2026-10-18T06:01:00Z',
          receivedAt: '2026-10-18T06:00:00Z',
          mode: 'cash',
          series: 'OF1',
          receipts: [{ lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
        });
      },
    },
    day_close_difference: {
      level: 'critical',
      count: 2,
      detail: { short: 1, extra: 1 },
      build: async () => {
        await db.query(`insert into counters (id, name) values (2, 'Counter 2')`);
        await db.query(
          `insert into day_closes (counter_id, business_date, cash_expected, cash_counted, upi_expected, upi_bank_total,
                                   series_ranges, outbox_pending, note, closed_by_staff_id, closed_at)
           values (1, '2026-10-18', 1110, 1100, 0, null, '[]', 0, 'Ten short', $1::uuid, now()),
                  (2, '2026-10-18', 200, 200, 505, 510, '[]', 0, 'Bank shows five more', $1::uuid, now()),
                  (1, '2026-10-17', 300, 300, 0, null, '[]', 0, null, $1::uuid, now())`,
          [staffId],
        );
      },
    },
  };

  test.each([
    'changed_amounts', 'number_gaps', 'day_not_closed', 'waiting_to_sync', 'clock_skew', 'backup', 'prasadam_pending',
    'upi_refunds_due', 'in_doubt_duplicates', 'future_offline', 'day_close_difference', 'cancellations',
  ])('needs attention raises %s from its fixture', async (id) => {
    const f = fixtures[id];
    await f.build();
    const c = card(await attention(db), id);
    expect({ level: c.level, count: c.count }).toEqual({ level: f.level, count: f.count });
    if (f.detail) expect(c.detail).toMatchObject(f.detail);
  });

  it('only an extra day-close difference is attention, not critical', async () => {
    await db.query(
      `insert into day_closes (counter_id, business_date, cash_expected, cash_counted, series_ranges, outbox_pending,
                               note, closed_by_staff_id, closed_at)
       values (1, '2026-10-18', 100, 120, '[]', 0, 'Twenty extra', $1::uuid, now())`,
      [staffId],
    );
    expect(card(await attention(db), 'day_close_difference')).toMatchObject({ level: 'attention', count: 1 });
    // Above the flag threshold only.
    await db.query(`update seva_settings set day_close_flag_threshold = 50 where id = 1`);
    expect(card(await attention(db), 'day_close_difference')).toMatchObject({ level: 'ok', count: 0 });
  });

  it('a stale or missing backup is critical', async () => {
    await db.query(`delete from ops_backup_runs`);
    expect(card(await attention(db), 'backup')).toMatchObject({ level: 'critical', count: 1, detail: { reason: 'never' } });
    await db.query(
      `insert into ops_backup_runs (started_at, finished_at, ok) values (now() - interval '40 hours', now() - interval '40 hours', true)`,
    );
    expect(card(await attention(db), 'backup')).toMatchObject({ level: 'critical', count: 1, detail: { reason: 'stale' } });
  });

  it('counts prasadam not collected for past seva dates in the period', async () => {
    await fx.order({
      issuedAt: '2026-10-15T05:00:00Z',
      mode: 'cash',
      receipts: [{ prasadam: 'pending', sevaDate: '2026-10-16', lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
    });
    await fx.order({
      issuedAt: '2026-10-18T08:40:00Z',
      mode: 'cash',
      receipts: [{ prasadam: 'pending', lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
    });
    const week = card(await attention(db, '2026-10-11T18:30:00Z', DAY_TO), 'prasadam_pending');
    expect(week).toMatchObject({ level: 'attention', count: 2, detail: { today: 1, past: 1 } });
    expect(card(await attention(db), 'prasadam_pending')).toMatchObject({ count: 1, detail: { past: 0 } });
  });

  it('needs attention lists future-dated offline receipts and clock skew', async () => {
    const device = await seedDevice(db, { staffId });
    await db.query(`update counter_devices set last_clock_skew_ms = 150000, last_seen_at = now() where id = $1`, [device]);
    await fx.order({
      issuedAt: '2026-10-18T05:10:00Z',
      receivedAt: '2026-10-18T05:07:30Z',
      mode: 'cash',
      series: 'OF1',
      receipts: [{ lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
    });
    const cards = await attention(db);
    expect(card(cards, 'future_offline')).toMatchObject({ level: 'attention', count: 1 });
    expect(card(cards, 'clock_skew')).toMatchObject({ level: 'attention', count: 1, detail: { max_skew_seconds: 150 } });
  });
});

describe('seva continuity and reports (A2-3)', () => {
  let db: PGlite;
  let fx: Fixture;
  let sevas: Awaited<ReturnType<typeof setup>>['sevas'];

  beforeAll(async () => {
    ({ db, fx, sevas } = await setup());
  });

  afterAll(async () => {
    await db.close();
  });

  it('continuity reports first, last, issued, cancelled and open gaps per series', async () => {
    const line = [{ sevaId: sevas.PAN, unit: '105.00' }];
    // C1 numbers 1..5 on 18 Oct (2 cancelled); 6 on 19 Oct is outside the range. OF1 1..2 with an open gap.
    for (let i = 0; i < 5; i += 1) {
      await fx.order({
        issuedAt: `2026-10-18T0${i + 3}:00:00Z`,
        mode: 'cash',
        receipts: [{ status: i === 1 || i === 3 ? 'cancelled' : 'issued', lines: line }],
      });
    }
    await fx.order({ issuedAt: '2026-10-19T05:00:00Z', mode: 'cash', receipts: [{ lines: line }] });
    await fx.order({ issuedAt: '2026-10-18T06:30:00Z', mode: 'cash', series: 'OF1', receipts: [{ lines: line }, { lines: line }] });
    await db.query(`insert into receipt_series_years (series_code, year, last_no) values ('OF1', 2026, 5)`);
    await db.query(
      `insert into receipt_number_gaps (series_code, year, from_no, to_no, cause) values ('OF1', 2026, 3, 4, 'missing_in_sync')`,
    );

    const rows = await svc(db, `select * from seva_continuity($1::date, $2::date)`, ['2026-10-18', '2026-10-18']);
    expect(rows).toEqual([
      { series_code: 'C1', year: 2026, first_no: 1, last_no: 5, issued: 3, cancelled: 2, open_gaps: 0 },
      { series_code: 'OF1', year: 2026, first_no: 1, last_no: 2, issued: 2, cancelled: 0, open_gaps: 1 },
    ]);
    await expect(svc(db, `select * from seva_continuity($1::date, $2::date)`, ['2026-10-19', '2026-10-18'])).rejects.toThrow(
      /SEVA:validation/,
    );
  });

  it('seva summary counts by seva date and includes last year', async () => {
    const pan = [{ sevaId: sevas.PAN, unit: '105.00' }];
    // Issued on 18 Oct 2026 for 21 Oct 2026 (last year of the 2027 range) - counted by seva date, not issue date.
    await fx.order({ issuedAt: '2026-10-18T05:00:00Z', mode: 'cash', receipts: [{ sevaDate: '2026-10-21', lines: pan }] });
    // 2027: two Panchamrita and one Paaduka in range, one out of range, one cancelled.
    await fx.order({ issuedAt: '2027-10-19T05:00:00Z', mode: 'cash', receipts: [{ sevaDate: '2027-10-20', lines: pan }] });
    await fx.order({
      issuedAt: '2027-10-19T05:10:00Z',
      mode: 'upi',
      receipts: [
        { sevaDate: '2027-10-22', lines: [...pan, { sevaId: sevas.PAA, unit: '505.00' }] },
        { sevaDate: '2027-10-25', lines: pan },
      ],
    });
    await fx.order({ issuedAt: '2027-10-19T05:20:00Z', mode: 'cash', receipts: [{ status: 'cancelled', sevaDate: '2027-10-21', lines: pan }] });
    await db.query(
      `insert into seva_rate_history (seva_id, old_amount, new_amount, reason, changed_at)
       values ($1::uuid, 100, 105, 'Office revision', '2027-10-21T04:00:00Z'),
              ($1::uuid, 90, 100, 'Older revision', '2027-09-01T04:00:00Z')`,
      [sevas.PAN],
    );

    const [{ s }] = await svc<{ s: Row }>(db, `select seva_seva_summary($1::date, $2::date) as s`, ['2027-10-20', '2027-10-22']);
    expect(s).toMatchObject({ from: '2027-10-20', to: '2027-10-22', last_year_from: '2026-10-20', last_year_to: '2026-10-22' });
    expect(s.sevas).toEqual([
      {
        seva_id: sevas.PAA,
        name_en: 'Paaduka Pooja',
        name_kn: null,
        category: 'Seva',
        receipts: 1,
        quantity: 1,
        amount: '505.00',
        last_year: { receipts: 0, quantity: 0, amount: '0.00' },
      },
      {
        seva_id: sevas.PAN,
        name_en: 'Panchamrita Abhisheka',
        name_kn: null,
        category: 'Seva',
        receipts: 2,
        quantity: 2,
        amount: '210.00',
        last_year: { receipts: 1, quantity: 1, amount: '105.00' },
      },
    ]);
    expect(s.totals).toEqual({ receipts: 2, amount: '715.00', last_year_receipts: 1, last_year_amount: '105.00' });
    expect(s.rate_changes).toEqual([
      expect.objectContaining({ seva_id: sevas.PAN, old_amount: '100.00', new_amount: '105.00', reason: 'Office revision' }),
    ]);
  });

  it('festival report compares with an earlier year', async () => {
    const [{ id }] = (
      await db.query<{ id: string }>(`insert into festival_days (name_en, name_kn) values ('Aaradhane', 'ಆರಾಧನೆ') returning id`)
    ).rows;
    await db.query(
      `insert into festival_day_dates (festival_id, day) values ($1, '2027-08-20'), ($1, '2027-08-21'), ($1, '2026-08-31')`,
      [id],
    );
    await fx.order({
      issuedAt: '2027-08-01T05:00:00Z',
      mode: 'cash',
      receipts: [
        { sevaDate: '2027-08-20', prasadam: 'given', lines: [{ sevaId: sevas.PAN, unit: '105.00' }] },
        { sevaDate: '2027-08-21', prasadam: 'pending', lines: [{ sevaId: sevas.PAA, unit: '505.00' }] },
      ],
    });
    await fx.order({
      issuedAt: '2026-08-30T05:00:00Z',
      mode: 'cash',
      receipts: [{ sevaDate: '2026-08-31', prasadam: 'given', lines: [{ sevaId: sevas.PAN, unit: '105.00' }] }],
    });

    const [{ r }] = await svc<{ r: Row }>(db, `select seva_festival_report($1::uuid, $2::smallint) as r`, [id, 2026]);
    expect(r).toMatchObject({ festival: { id, name_en: 'Aaradhane', name_kn: 'ಆರಾಧನೆ' }, year: 2027, compare_year: 2026 });
    expect(r.current).toEqual({
      dates: ['2027-08-20', '2027-08-21'],
      receipts: 2,
      amount: '610.00',
      prasadam_receipts: 2,
      prasadam_given: 1,
      sevas: [
        { seva_id: sevas.PAA, name_en: 'Paaduka Pooja', name_kn: null, quantity: 1, amount: '505.00' },
        { seva_id: sevas.PAN, name_en: 'Panchamrita Abhisheka', name_kn: null, quantity: 1, amount: '105.00' },
      ],
      per_day: [
        { date: '2027-08-20', receipts: 1, amount: '105.00' },
        { date: '2027-08-21', receipts: 1, amount: '505.00' },
      ],
    });
    expect(r.compare).toMatchObject({ dates: ['2026-08-31'], receipts: 1, amount: '105.00', prasadam_given: 1 });

    // An earlier year without its own dates uses the same days of that year.
    const [{ r: r2 }] = await svc<{ r: Row }>(db, `select seva_festival_report($1::uuid, $2::smallint) as r`, [id, 2025]);
    expect(r2.compare).toMatchObject({ dates: ['2025-08-20', '2025-08-21'], receipts: 0, amount: '0.00' });

    await expect(svc(db, `select seva_festival_report($1::uuid, $2::smallint)`, [id, 2027])).rejects.toThrow(/SEVA:validation/);
    await expect(
      svc(db, `select seva_festival_report('00000000-0000-4000-8000-000000000000'::uuid, 2026::smallint)`),
    ).rejects.toThrow(/SEVA:not_found/);
  });

  it('lets only service_role execute the report functions', async () => {
    for (const sig of [
      'seva_continuity(date,date)',
      'seva_dashboard(timestamptz,timestamptz,timestamptz,timestamptz,text)',
      'seva_needs_attention(timestamptz,timestamptz,date)',
      'seva_seva_summary(date,date)',
      'seva_festival_report(uuid,smallint)',
    ]) {
      const priv = (
        await db.query<Row>(
          `select has_function_privilege('anon', $1, 'EXECUTE') as anon,
                  has_function_privilege('authenticated', $1, 'EXECUTE') as auth,
                  has_function_privilege('service_role', $1, 'EXECUTE') as service`,
          [sig],
        )
      ).rows[0];
      expect({ sig, ...priv }).toEqual({ sig, anon: false, auth: false, service: true });
    }
  });
});
