/**
 * Database tests for Task A2-1 (part 2 of 3): storing an offline (OF series) order with seva_sync_offline_order -
 * exactly as printed, idempotent, with number gaps recorded and closed, the retired-PC rule, the C-58 rate audit and
 * the in-doubt supersede of DB 8.6. A2-FIX: the order carries its issuer (the staff no. inside its OF numbers), who
 * may differ from the person who syncs it; and after "Replace this PC" the heartbeat's group floor stops a new PC from
 * reusing an offline group label. A2-FIX2: the floor also reserves the labels the dead PC printed but never sent; the
 * line audits of a synced order name the issuer; an issuer offboarded after issuing is still accepted (and audited).
 *
 * Every test starts from its own copy of one migrated template database (a PGlite data-dir clone). Seed helpers only
 * set the starting state; every rule is proved through the SQL functions, called as service_role.
 */
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { asRole, freshDb } from './harness';
import { seedDevice, seedSeva, seedStaff } from './fixtures';

interface Ctx {
  db: PGlite;
  staffId: string;
  deviceId: string;
  pan: string;
  paa: string;
  kar: string;
  today: string;
}

interface SqlLine {
  seva_id: string;
  catalogue_rate: string | null;
  unit_rate: string;
  amount: string;
  changed: boolean;
  change_reason: string | null;
}

interface SqlReceipt {
  id: string;
  receipt_no: string;
  series_code: string;
  seva_date: string;
  business_date: string;
  position: number;
  count: number;
  total: string;
  lines: SqlLine[];
  issued_at: string;
  issued_by: { name: string; staff_no: number | null };
  issued_offline: boolean;
  status: string;
  has_changed_amount: boolean;
}

interface OrderResult {
  order_id: string;
  group_no: string;
  duplicate: boolean;
  receipts: SqlReceipt[];
}

interface OfflineLine {
  sevaId: string;
  quantity?: number;
  unitRate?: string | null;
  cachedRate: string | null;
  changeReason?: string | null;
}

interface OfflineReceipt {
  runningNo: number;
  receiptNo?: string;
  date?: string;
  lines?: OfflineLine[];
}

interface OfflineSpec {
  issuedAt: string;
  receipts: OfflineReceipt[];
  expectedTotal?: string;
  groupNo?: string;
  payment?: Record<string, unknown>;
  supersedes?: string;
  clientOrderId?: string;
  /** The issuer's staff no. sent with the order (default 23, Ramesh); null leaves it out. */
  issuerStaffNo?: number | null;
}

/** Who calls the sync: the signed-in person (default Ramesh) and the issuer's role the route read from Firestore. */
interface SyncAs {
  syncerId?: string;
  issuerRole?: string | null;
}

interface SevaFailure {
  code: string;
  detail: Record<string, unknown> | null;
}

interface GapRow {
  from_no: number;
  to_no: number;
  cause: string;
  status: string;
}

/** 10:30 AM IST on 18 October 2026. */
const ISSUED = '2026-10-18T05:00:00.000Z';
const SEVA_DATE = '2026-10-20';

let template: Blob;
let ctx: Ctx | null = null;
let groupSeq = 0;

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
  const deviceId = await seedDevice(db, { staffId });
  const pan = await seedSeva(db, { code: 'PAN', nameEn: 'Panchamrutha Abhisheka', amount: '105.00', multiDate: true });
  const paa = await seedSeva(db, { code: 'PAA', nameEn: 'Paaduka Pooja', amount: '505.00' });
  const kar = await seedSeva(db, { code: 'KAR', nameEn: 'Other Seva / Karnike', amount: null });
  const parts = await db.query<{ d: string }>('select p.business_date::text as d from seva_ist_parts(now()) p');
  ctx = { db, staffId, deviceId, pan, paa, kar, today: parts.rows[0].d };
  return ctx;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function istParts(iso: string): { mm: string; yyyy: string; yymm: string } {
  const t = new Date(Date.parse(iso) + 330 * 60_000);
  const mm = pad(t.getUTCMonth() + 1, 2);
  const yyyy = String(t.getUTCFullYear());
  return { mm, yyyy, yymm: `${yyyy.slice(2)}${mm}` };
}

/** The number the PC prints: OF1-023-<IST MM>-<IST YYYY>/<running>. */
function ofNo(iso: string, running: number, series = 'OF1', staffNo = '023'): string {
  const p = istParts(iso);
  return `${series}-${staffNo}-${p.mm}-${p.yyyy}/${pad(running, 6)}`;
}

function qrToken(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * An offline order as the PC sends it; each receipt defaults to one PAN line at the cached rate 105.00 and a number
 * carrying the issuer's staff no.
 */
function offlineOrder(c: Ctx, p: OfflineSpec): Record<string, unknown> {
  const issuerNo = typeof p.issuerStaffNo === 'number' ? p.issuerStaffNo : 23;
  const receipts = p.receipts.map((r, i) => {
    const lines = r.lines ?? [{ sevaId: c.pan, cachedRate: '105.00' }];
    return {
      client_receipt_id: randomUUID(),
      seva_date: r.date ?? addDays(SEVA_DATE, i),
      qr_token: qrToken(),
      running_no: r.runningNo,
      receipt_no: r.receiptNo ?? ofNo(p.issuedAt, r.runningNo, 'OF1', pad(issuerNo, 3)),
      lines: lines.map((l) => ({
        seva_id: l.sevaId,
        quantity: l.quantity ?? 1,
        unit_rate: l.unitRate ?? null,
        cached_rate: l.cachedRate,
        change_reason: l.changeReason ?? null,
      })),
    };
  });
  groupSeq += 1;
  return {
    client_order_id: p.clientOrderId ?? randomUUID(),
    supersedes_client_order_id: p.supersedes ?? null,
    ...(p.issuerStaffNo === null ? {} : { issuer_staff_no: issuerNo }),
    issued_at: p.issuedAt,
    group_no: p.groupNo ?? `G-${istParts(p.issuedAt).yymm}-OF1-${pad(groupSeq, 3)}`,
    expected_total: p.expectedTotal ?? `${105 * receipts.length}.00`,
    devotee: { name: 'Venkatesh Rao', gotra: 'Bharadwaja', gotra_id: 7, nakshatra_id: 4, phone_e164: null },
    payment: p.payment ?? { mode: 'cash', cash_received: null },
    receipts,
  };
}

function addDays(date: string, days: number): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

async function sync(
  c: Ctx,
  order: Record<string, unknown>,
  deviceId: string = c.deviceId,
  as: SyncAs = {},
): Promise<OrderResult> {
  return asRole(c.db, 'service_role', async (d) => {
    const r = await d.query<{ r: OrderResult }>(
      'select seva_sync_offline_order($1::jsonb, $2::uuid, $3::uuid, $4::text) as r',
      [
        JSON.stringify(order),
        as.syncerId ?? c.staffId,
        deviceId,
        as.issuerRole === undefined ? 'receptionist' : as.issuerRole,
      ],
    );
    return r.rows[0].r;
  });
}

interface HeartbeatResult {
  of_series: string;
  last_of_no: number;
  last_of_group_no: number;
}

async function heartbeat(c: Ctx, deviceId: string): Promise<HeartbeatResult> {
  return asRole(c.db, 'service_role', async (d) => {
    const r = await d.query<{ r: HeartbeatResult }>(`select seva_heartbeat($1::uuid, 0, 0, 'test') as r`, [deviceId]);
    return r.rows[0].r;
  });
}

/** "Replace this PC" on Counter 1 with the number on the last slip that came out of the printer; the new device id. */
async function replaceDevice(c: Ctx, lastPrintedOfNo: number): Promise<string> {
  return asRole(c.db, 'service_role', async (d) => {
    const r = await d.query<{ id: string }>(
      `select seva_replace_device(1::smallint, $1, 'New PC', $2::int, 'Old PC stopped working', $3::uuid) as id`,
      [createHash('sha256').update(randomBytes(32)).digest('hex'), lastPrintedOfNo, c.staffId],
    );
    return r.rows[0].id;
  });
}

interface AuditRow {
  action: string;
  entity_id: string;
  actor_staff_id: string | null;
  actor_role: string | null;
  after: Record<string, unknown> | null;
}

async function auditRows(db: PGlite, where = 'true'): Promise<AuditRow[]> {
  const r = await db.query<AuditRow>(
    `select action, entity_id, actor_staff_id, actor_role, after from audit_log where ${where} order by id`,
  );
  return r.rows;
}

/** What a route does before calling a function: names the signed-in person's role for the audit rows. */
async function setRouteRole(db: PGlite, role: string): Promise<void> {
  await db.query(`select set_config('seva.actor_role', $1, false)`, [role]);
}

/** Same-number shorthand: one receipt with the given running number, issued at ISSUED. */
async function syncNo(c: Ctx, running: number, deviceId: string = c.deviceId): Promise<OrderResult> {
  return sync(c, offlineOrder(c, { issuedAt: ISSUED, receipts: [{ runningNo: running }] }), deviceId);
}

async function issueOnline(c: Ctx, clientOrderId: string): Promise<OrderResult> {
  const order = {
    client_order_id: clientOrderId,
    expected_total: '210.00',
    devotee: { name: 'Venkatesh Rao' },
    payment: { mode: 'cash' },
    receipts: [1, 2].map((d) => ({
      client_receipt_id: randomUUID(),
      seva_date: addDays(c.today, d),
      qr_token: qrToken(),
      lines: [{ seva_id: c.pan, quantity: 1, unit_rate: null }],
    })),
  };
  return asRole(c.db, 'service_role', async (d) => {
    const r = await d.query<{ r: OrderResult }>('select seva_issue_counter_order($1::jsonb, $2::uuid, $3::uuid) as r', [
      JSON.stringify(order),
      c.staffId,
      c.deviceId,
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

async function gaps(db: PGlite): Promise<GapRow[]> {
  const r = await db.query<GapRow>(
    `select from_no, to_no, cause, status from receipt_number_gaps order by from_no, id`,
  );
  return r.rows;
}

describe('seva_sync_offline_order (A2-1)', () => {
  it('stores an offline order exactly as printed', async () => {
    const c = await setup();
    const res = await sync(
      c,
      offlineOrder(c, {
        issuedAt: ISSUED,
        groupNo: 'G-2610-OF1-001',
        expectedTotal: '610.00',
        receipts: [
          { runningNo: 1, lines: [{ sevaId: c.pan, cachedRate: '105.00' }, { sevaId: c.paa, cachedRate: '505.00' }] },
        ],
      }),
    );

    expect(res).toMatchObject({ duplicate: false, group_no: 'G-2610-OF1-001' });
    expect(res.receipts).toHaveLength(1);
    expect(res.receipts[0]).toMatchObject({
      receipt_no: 'OF1-023-10-2026/000001',
      series_code: 'OF1',
      seva_date: SEVA_DATE,
      business_date: '2026-10-18',
      position: 1,
      count: 1,
      total: '610.00',
      status: 'issued',
      issued_offline: true,
      issued_by: { name: 'Ramesh', staff_no: 23 },
    });
    expect(Date.parse(res.receipts[0].issued_at)).toBe(Date.parse(ISSUED));
    const order = await c.db.query<{ issued_offline: boolean; group_no: string; issued_ms: number; total: string }>(
      `select issued_offline, group_no, (extract(epoch from issued_at) * 1000)::bigint::float8 as issued_ms,
              amount_total::text as total
         from seva_orders`,
    );
    expect(order.rows).toEqual([
      { issued_offline: true, group_no: 'G-2610-OF1-001', issued_ms: Date.parse(ISSUED), total: '610.00' },
    ]);
    expect(await lastNo(c.db, 'OF1', 2026)).toBe(1);

    await syncNo(c, 2);
    expect(await lastNo(c.db, 'OF1', 2026)).toBe(2);
    expect(await gaps(c.db)).toEqual([]);
    // Syncing writes no audit row when nothing differs (C-36).
    expect(await count(c.db, 'audit_log')).toBe(0);
  });

  it('ignores a duplicate client_receipt_id', async () => {
    const c = await setup();
    const order = offlineOrder(c, { issuedAt: ISSUED, receipts: [{ runningNo: 1 }] });
    const first = await sync(c, order);
    const again = await sync(c, order);
    expect(again.duplicate).toBe(true);
    expect(again.order_id).toBe(first.order_id);
    expect(again.receipts.map((r) => r.id)).toEqual(first.receipts.map((r) => r.id));

    // A resend under a new order id but with the same printed receipts is the same order.
    const resent = await sync(c, { ...order, client_order_id: randomUUID() });
    expect(resent.duplicate).toBe(true);
    expect(resent.order_id).toBe(first.order_id);

    expect(await count(c.db, 'seva_orders')).toBe(1);
    expect(await count(c.db, 'seva_receipts')).toBe(1);
    expect(await lastNo(c.db, 'OF1', 2026)).toBe(1);
  });

  it('records a missing_in_sync gap when numbers jump', async () => {
    const c = await setup();
    await sync(c, offlineOrder(c, { issuedAt: ISSUED, receipts: [{ runningNo: 1 }, { runningNo: 2 }, { runningNo: 3 }] }));
    expect(await lastNo(c.db, 'OF1', 2026)).toBe(3);

    await syncNo(c, 6);
    expect(await gaps(c.db)).toEqual([{ from_no: 4, to_no: 5, cause: 'missing_in_sync', status: 'open' }]);
    const gap = await c.db.query('select series_code, year from receipt_number_gaps');
    expect(gap.rows).toEqual([{ series_code: 'OF1', year: 2026 }]);
    expect(await lastNo(c.db, 'OF1', 2026)).toBe(6);
  });

  it('fills an open gap with a late number and marks it received_late when full', async () => {
    const c = await setup();
    await syncNo(c, 1);
    await syncNo(c, 4);
    expect(await gaps(c.db)).toEqual([{ from_no: 2, to_no: 3, cause: 'missing_in_sync', status: 'open' }]);

    await syncNo(c, 2);
    expect(await gaps(c.db)).toEqual([{ from_no: 3, to_no: 3, cause: 'missing_in_sync', status: 'open' }]);

    await syncNo(c, 3);
    const closed = await c.db.query<{ status: string; note: string | null; resolved: boolean }>(
      `select status, resolution_note as note, resolved_at is not null as resolved from receipt_number_gaps`,
    );
    expect(closed.rows).toEqual([{ status: 'received_late', note: 'Arrived in a later sync', resolved: true }]);
    expect(await lastNo(c.db, 'OF1', 2026)).toBe(4);

    // A late number in the middle splits the gap.
    await syncNo(c, 10);
    await syncNo(c, 7);
    expect((await gaps(c.db)).filter((g) => g.status === 'open')).toEqual([
      { from_no: 5, to_no: 6, cause: 'missing_in_sync', status: 'open' },
      { from_no: 8, to_no: 9, cause: 'missing_in_sync', status: 'open' },
    ]);
    // Every gap that is no longer open carries a resolution note.
    expect(await count(c.db, 'receipt_number_gaps', `status <> 'open' and coalesce(btrim(resolution_note), '') = ''`)).toBe(0);
    expect(await count(c.db, 'seva_receipts')).toBe(6);
  });

  it('refuses a lower number outside any gap and a number from another counter series', async () => {
    const c = await setup();
    await sync(c, offlineOrder(c, { issuedAt: ISSUED, receipts: [{ runningNo: 1 }, { runningNo: 2 }, { runningNo: 3 }] }));
    await syncNo(c, 6);
    await c.db.query(
      `update receipt_number_gaps set status = 'declared_lost', resolution_note = 'Slips lost in the rain', resolved_at = now()`,
    );

    expect((await failure(syncNo(c, 4))).code).toBe('number_conflict');
    expect((await failure(syncNo(c, 2))).code).toBe('number_conflict');
    expect(
      (await failure(sync(c, offlineOrder(c, { issuedAt: ISSUED, receipts: [{ runningNo: 7, receiptNo: 'C1-023-10-2026/000007' }] })))).code,
    ).toBe('number_conflict');
    expect(
      (await failure(sync(c, offlineOrder(c, { issuedAt: ISSUED, receipts: [{ runningNo: 7, receiptNo: 'OF2-023-10-2026/000007' }] })))).code,
    ).toBe('number_conflict');

    expect(await lastNo(c.db, 'OF1', 2026)).toBe(6);
    expect(await count(c.db, 'seva_receipts')).toBe(4);
  });

  it('accepts a retired device only inside its device_replaced gap', async () => {
    const c = await setup();
    const oldPc = c.deviceId;
    await sync(c, offlineOrder(c, { issuedAt: ISSUED, receipts: [{ runningNo: 1 }, { runningNo: 2 }] }));

    // "Replace this PC" (A2-2 owns the function): the old PC is retired, the slip in the printer said 6.
    await c.db.query(
      `update counter_devices set retired_at = now(), retired_by_staff_id = $2::uuid, retired_reason = 'PC died'
        where id = $1`,
      [oldPc, c.staffId],
    );
    const newPc = await seedDevice(c.db, { staffId: c.staffId });
    await c.db.query(`update receipt_series_years set last_no = 6 where series_code = 'OF1' and year = 2026`);
    await c.db.query(
      `insert into receipt_number_gaps (series_code, year, from_no, to_no, cause) values ('OF1', 2026, 3, 6, 'device_replaced')`,
    );

    await syncNo(c, 4, oldPc);
    expect(await gaps(c.db)).toEqual([
      { from_no: 3, to_no: 3, cause: 'device_replaced', status: 'open' },
      { from_no: 5, to_no: 6, cause: 'device_replaced', status: 'open' },
    ]);
    expect((await failure(syncNo(c, 7, oldPc))).code).toBe('device_unknown');

    await syncNo(c, 7, newPc);
    await syncNo(c, 9, newPc);
    // 8 is a missing_in_sync gap of the new PC: the retired PC may not fill it.
    expect((await failure(syncNo(c, 8, oldPc))).code).toBe('device_unknown');

    await syncNo(c, 3, oldPc);
    await syncNo(c, 5, oldPc);
    await syncNo(c, 6, oldPc);
    const replaced = await c.db.query<{ status: string; note: string | null }>(
      `select status, resolution_note as note from receipt_number_gaps where cause = 'device_replaced' order by from_no`,
    );
    expect(replaced.rows).toEqual([
      { status: 'received_late', note: 'Arrived in a later sync' },
      { status: 'received_late', note: 'Arrived in a later sync' },
    ]);
    expect(await lastNo(c.db, 'OF1', 2026)).toBe(9);
    expect(await count(c.db, 'seva_receipts')).toBe(8);
  });

  it('sync accepts a 1 January OF number in the new year', async () => {
    const c = await setup();
    const issuedAt = '2026-12-31T18:31:00Z';
    const res = await sync(
      c,
      offlineOrder(c, { issuedAt, receipts: [{ runningNo: 1, receiptNo: 'OF1-023-01-2027/000001', date: '2027-01-02' }] }),
    );
    expect(res.receipts[0]).toMatchObject({ receipt_no: 'OF1-023-01-2027/000001', business_date: '2027-01-01' });
    const row = await c.db.query('select year, month, business_date::text as business_date from seva_receipts');
    expect(row.rows).toEqual([{ year: 2027, month: 1, business_date: '2027-01-01' }]);
    expect(await lastNo(c.db, 'OF1', 2027)).toBe(1);
    expect(await lastNo(c.db, 'OF1', 2026)).toBe(0);
  });

  it('refuses a receipt number that does not match its parts', async () => {
    const c = await setup();
    for (const receipt of [
      { runningNo: 1, receiptNo: 'OF1-023-11-2026/000001' },
      { runningNo: 2, receiptNo: 'OF1-023-10-2026/000001' },
      { runningNo: 1, receiptNo: 'OF1-024-10-2026/000001' },
      { runningNo: 1, receiptNo: 'OF1-023-10-2027/000001' },
    ]) {
      expect({ receipt, failure: await failure(sync(c, offlineOrder(c, { issuedAt: ISSUED, receipts: [receipt] }))) }).toEqual({
        receipt,
        failure: { code: 'validation', detail: expect.objectContaining({ field: 'receipt_no' }) },
      });
    }
    expect(await count(c.db, 'seva_receipts')).toBe(0);
  });

  it("audits an offline rate that differs from today's catalogue", async () => {
    const c = await setup();
    const res = await sync(
      c,
      offlineOrder(c, {
        issuedAt: ISSUED,
        expectedTotal: '656.00',
        receipts: [
          {
            runningNo: 1,
            lines: [
              { sevaId: c.pan, cachedRate: '100.00' },
              { sevaId: c.paa, cachedRate: '505.00' },
              // An any-amount seva is told by its any_amount flag: a cached 0.00 is not a catalogue rate.
              { sevaId: c.kar, cachedRate: '0.00', unitRate: '51.00' },
            ],
          },
        ],
      }),
    );

    const receipt = res.receipts[0];
    expect(receipt.has_changed_amount).toBe(false);
    expect(receipt.total).toBe('656.00');
    expect(receipt.lines.map((l) => [l.catalogue_rate, l.unit_rate, l.changed])).toEqual([
      ['100.00', '100.00', false],
      ['505.00', '505.00', false],
      [null, '51.00', false],
    ]);
    const audit = await c.db.query<{ action: string; entity_id: string; receipt_no: string; before: unknown; after: unknown }>(
      `select action, entity_id, receipt_no, before, after from audit_log order by id`,
    );
    expect(audit.rows).toEqual([
      {
        action: 'receipt.amount_changed',
        entity_id: receipt.id,
        receipt_no: receipt.receipt_no,
        before: expect.objectContaining({ seva_id: c.pan, catalogue_rate: '105.00' }),
        after: expect.objectContaining({ seva_id: c.pan, offline_rate: '100.00', unit_rate: '100.00' }),
      },
    ]);
  });

  it('marks an amount changed offline like the counter does', async () => {
    const c = await setup();
    const changed = (reason: string | null): Record<string, unknown> =>
      offlineOrder(c, {
        issuedAt: ISSUED,
        expectedTotal: '150.00',
        receipts: [{ runningNo: 1, lines: [{ sevaId: c.pan, cachedRate: '105.00', unitRate: '150.00', changeReason: reason }] }],
      });
    expect((await failure(sync(c, changed(null)))).code).toBe('change_reason_required');

    const res = await sync(c, changed('Devotee offered more'));
    expect(res.receipts[0].has_changed_amount).toBe(true);
    expect(res.receipts[0].lines[0]).toMatchObject({ catalogue_rate: '105.00', unit_rate: '150.00', changed: true });
    const audit = await c.db.query('select action, reason from audit_log');
    expect(audit.rows).toEqual([{ action: 'receipt.amount_changed', reason: 'Devotee offered more' }]);
  });

  it('refuses a group number another order already uses', async () => {
    const c = await setup();
    await sync(c, offlineOrder(c, { issuedAt: ISSUED, groupNo: 'G-2610-OF1-001', receipts: [{ runningNo: 1 }] }));
    expect(
      await failure(sync(c, offlineOrder(c, { issuedAt: ISSUED, groupNo: 'G-2610-OF1-001', receipts: [{ runningNo: 2 }] }))),
    ).toMatchObject({ code: 'number_conflict', detail: { field: 'group_no' } });
    expect(await lastNo(c.db, 'OF1', 2026)).toBe(1);
  });

  it('cancels an unprinted superseded C order and links the OF order', async () => {
    const c = await setup();
    const cOrderId = randomUUID();
    const online = await issueOnline(c, cOrderId);
    const issuedAt = new Date().toISOString();

    const res = await sync(
      c,
      offlineOrder(c, { issuedAt, supersedes: cOrderId, receipts: [{ runningNo: 1 }, { runningNo: 2 }] }),
    );
    const firstOf = ofNo(issuedAt, 1);
    expect(res.receipts[0].receipt_no).toBe(firstOf);

    const cancelled = await c.db.query(
      `select status, cancel_reason_code, cancel_note, refund_state, cancelled_by_staff_id
         from seva_receipts where order_id = $1 order by position`,
      [online.order_id],
    );
    const expected = {
      status: 'cancelled',
      cancel_reason_code: 'not_printed_connection_lost',
      cancel_note: `Not printed: connection lost before the reply; reissued offline as ${firstOf}`,
      refund_state: 'none',
      cancelled_by_staff_id: c.staffId,
    };
    expect(cancelled.rows).toEqual([expected, expected]);
    const link = await c.db.query('select supersedes_order_id from seva_orders where id = $1', [res.order_id]);
    expect(link.rows).toEqual([{ supersedes_order_id: online.order_id }]);
    const audit = await c.db.query<{ entity_id: string }>(
      `select entity_id from audit_log where action = 'receipt.superseded' order by id`,
    );
    expect(audit.rows.map((r) => r.entity_id)).toEqual(online.receipts.map((r) => r.id));
  });

  it('leaves a printed superseded C order alone', async () => {
    const c = await setup();
    const cOrderId = randomUUID();
    const online = await issueOnline(c, cOrderId);
    await asRole(c.db, 'service_role', (d) =>
      d.query(`select seva_record_prints($1::uuid[], $2::uuid, $3::uuid)`, [
        `{${online.receipts[0].id}}`,
        c.staffId,
        c.deviceId,
      ]),
    );

    const res = await sync(
      c,
      offlineOrder(c, { issuedAt: new Date().toISOString(), supersedes: cOrderId, receipts: [{ runningNo: 1 }, { runningNo: 2 }] }),
    );
    expect(await count(c.db, 'seva_receipts', `order_id = '${online.order_id}' and status = 'issued'`)).toBe(2);
    // The link stays, so Needs attention can ask an admin to cancel one of the two (DB 8.6).
    const link = await c.db.query('select supersedes_order_id from seva_orders where id = $1', [res.order_id]);
    expect(link.rows).toEqual([{ supersedes_order_id: online.order_id }]);
    expect(await count(c.db, 'audit_log', `action = 'receipt.superseded'`)).toBe(0);
  });

  it('stores an order made offline by A and synced by B, with A as issuer and B as syncer', async () => {
    const c = await setup();
    const suresh = await seedStaff(c.db, { staffNo: 24, name: 'Suresh', uid: 'uid-suresh' });

    // Ramesh (023, a receptionist) printed the receipts offline - one line at an older cached rate (C-58) and one
    // changed amount; Suresh signed in on the same PC before the outbox was sent, and the route names his role.
    await setRouteRole(c.db, 'temple_admin');
    const res = await sync(
      c,
      offlineOrder(c, {
        issuedAt: ISSUED,
        expectedTotal: '705.00',
        receipts: [
          {
            runningNo: 1,
            lines: [
              { sevaId: c.pan, cachedRate: '100.00' },
              { sevaId: c.paa, cachedRate: '505.00', unitRate: '500.00', changeReason: 'Regular devotee' },
            ],
          },
          { runningNo: 2 },
        ],
      }),
      c.deviceId,
      { syncerId: suresh, issuerRole: 'receptionist' },
    );
    expect(res.duplicate).toBe(false);
    // The line audits are Ramesh's: he printed those amounts. They carry his role, not the syncer's.
    const lineAudits = await auditRows(c.db, `action = 'receipt.amount_changed'`);
    expect(lineAudits).toHaveLength(2);
    expect(lineAudits.map((a) => [a.actor_staff_id, a.actor_role])).toEqual([
      [c.staffId, 'receptionist'],
      [c.staffId, 'receptionist'],
    ]);
    expect(res.receipts.map((r) => [r.receipt_no, r.issued_by])).toEqual([
      ['OF1-023-10-2026/000001', { name: 'Ramesh', staff_no: 23 }],
      ['OF1-023-10-2026/000002', { name: 'Ramesh', staff_no: 23 }],
    ]);
    const order = await c.db.query('select issued_by_staff_id, synced_by_staff_id from seva_orders where id = $1', [
      res.order_id,
    ]);
    expect(order.rows).toEqual([{ issued_by_staff_id: c.staffId, synced_by_staff_id: suresh }]);
    const rows = await c.db.query(
      `select staff_no, issued_by_staff_id, issued_by_name from seva_receipts where order_id = $1 order by running_no`,
      [res.order_id],
    );
    const byRamesh = { staff_no: 23, issued_by_staff_id: c.staffId, issued_by_name: 'Ramesh' };
    expect(rows.rows).toEqual([byRamesh, byRamesh]);
    expect(await lastNo(c.db, 'OF1', 2026)).toBe(2);

    // Suresh's own offline receipts carry his number and name.
    const own = await sync(
      c,
      offlineOrder(c, { issuedAt: ISSUED, issuerStaffNo: 24, receipts: [{ runningNo: 3 }] }),
      c.deviceId,
      { syncerId: suresh },
    );
    expect(own.receipts[0]).toMatchObject({ receipt_no: 'OF1-024-10-2026/000003', issued_by: { name: 'Suresh', staff_no: 24 } });

    // An order saved online has no syncer.
    const online = await issueOnline(c, randomUUID());
    const onlineRow = await c.db.query('select synced_by_staff_id from seva_orders where id = $1', [online.order_id]);
    expect(onlineRow.rows).toEqual([{ synced_by_staff_id: null }]);
  });

  it('accepts an issuer offboarded after issuing, and audits receipt.issuer_inactive_at_sync', async () => {
    const c = await setup();
    const suresh = await seedStaff(c.db, { staffNo: 24, name: 'Suresh', uid: 'uid-suresh' });
    const former = await seedStaff(c.db, { staffNo: 25, name: 'Former', uid: 'uid-former' });
    await c.db.query(`update staff set status = 'inactive', status_reason = 'Left' where id = $1`, [former]);
    await setRouteRole(c.db, 'temple_admin');

    // Former (025) printed two receipts offline - one with a changed amount - and was offboarded before they synced.
    const res = await sync(
      c,
      offlineOrder(c, {
        issuedAt: ISSUED,
        issuerStaffNo: 25,
        expectedTotal: '605.00',
        receipts: [
          { runningNo: 1, lines: [{ sevaId: c.paa, cachedRate: '505.00', unitRate: '500.00', changeReason: 'Regular devotee' }] },
          { runningNo: 2 },
        ],
      }),
      c.deviceId,
      { syncerId: suresh, issuerRole: 'receptionist' },
    );
    expect(res.receipts.map((r) => [r.receipt_no, r.issued_by])).toEqual([
      ['OF1-025-10-2026/000001', { name: 'Former', staff_no: 25 }],
      ['OF1-025-10-2026/000002', { name: 'Former', staff_no: 25 }],
    ]);
    const ids = res.receipts.map((r) => r.id);
    expect(await auditRows(c.db)).toEqual([
      expect.objectContaining({ action: 'receipt.amount_changed', entity_id: ids[0], actor_staff_id: former, actor_role: 'receptionist' }),
      // Written by the sync, so the syncer and the route's role are restored for it.
      ...ids.map((id) =>
        expect.objectContaining({
          action: 'receipt.issuer_inactive_at_sync',
          entity_id: id,
          actor_staff_id: suresh,
          actor_role: 'temple_admin',
          after: expect.objectContaining({ issuer_staff_id: former, issuer_staff_no: 25, synced_by_staff_id: suresh }),
        }),
      ),
    ]);

    // An active issuer writes no such row.
    await sync(c, offlineOrder(c, { issuedAt: ISSUED, receipts: [{ runningNo: 3 }] }), c.deviceId, { syncerId: suresh });
    expect(await count(c.db, 'audit_log', `action = 'receipt.issuer_inactive_at_sync'`)).toBe(2);
  });

  it('refuses an unknown, invited or deleted issuer with SEVA:validation', async () => {
    const c = await setup();
    const suresh = await seedStaff(c.db, { staffNo: 24, name: 'Suresh', uid: 'uid-suresh' });
    const gone = await seedStaff(c.db, { staffNo: 25, name: 'Gone', uid: 'uid-gone' });
    await c.db.query(`update staff set status = 'deleted', status_reason = 'Removed' where id = $1`, [gone]);
    await seedStaff(c.db, { staffNo: 26, name: 'Invited', uid: 'uid-invited', status: 'invited' });
    const bySuresh: SyncAs = { syncerId: suresh };

    // 99: no such staff; 25: deleted; 26: invited, never signed in; null: no issuer sent.
    for (const issuerStaffNo of [99, 25, 26, null]) {
      const refused = await failure(
        sync(c, offlineOrder(c, { issuedAt: ISSUED, issuerStaffNo, receipts: [{ runningNo: 1 }] }), c.deviceId, bySuresh),
      );
      expect({ issuerStaffNo, refused }).toEqual({
        issuerStaffNo,
        refused: { code: 'validation', detail: expect.objectContaining({ field: 'issuer_staff_no' }) },
      });
    }

    // The numbers must carry the issuer's staff no.: Ramesh's numbers sent with Suresh as issuer are refused.
    expect(
      await failure(
        sync(
          c,
          offlineOrder(c, { issuedAt: ISSUED, issuerStaffNo: 24, receipts: [{ runningNo: 1, receiptNo: ofNo(ISSUED, 1) }] }),
          c.deviceId,
          bySuresh,
        ),
      ),
    ).toEqual({ code: 'validation', detail: expect.objectContaining({ field: 'receipt_no' }) });

    expect(await count(c.db, 'seva_orders')).toBe(0);
    expect(await count(c.db, 'seva_receipts')).toBe(0);
    expect(await lastNo(c.db, 'OF1', 2026)).toBe(0);
  });

  it('accepts only an issuer who may use the counter (DB 3.3 row 1)', async () => {
    const c = await setup();
    await seedStaff(c.db, { staffNo: 1, name: 'Temple Admin', uid: 'uid-admin' });
    const viewer = await seedStaff(c.db, { staffNo: 2, name: 'Board Member', uid: 'uid-viewer' });
    await c.db.query('update staff set view_only = true where id = $1', [viewer]);
    let running = 0;
    const order = (issuerStaffNo: number): Record<string, unknown> => {
      running += 1;
      return offlineOrder(c, { issuedAt: ISSUED, issuerStaffNo, receipts: [{ runningNo: running }] });
    };

    const allowed: [number, string][] = [
      [23, 'receptionist'],
      [1, 'temple_admin'],
      [1, 'super_admin'],
    ];
    for (const [no, role] of allowed) {
      expect(await sync(c, order(no), c.deviceId, { issuerRole: role })).toMatchObject({ duplicate: false });
    }

    // A prasadam counter, a view-only temple admin or super admin, an unknown role and no role at all are refused.
    const refused: [number, string | null][] = [
      [23, 'prasadam_counter'],
      [2, 'temple_admin'],
      [2, 'super_admin'],
      [23, 'devotee'],
      [23, null],
    ];
    for (const [no, role] of refused) {
      const f = await failure(sync(c, order(no), c.deviceId, { issuerRole: role }));
      expect({ no, role, f }).toEqual({
        no,
        role,
        f: { code: 'validation', detail: expect.objectContaining({ field: 'issuer_staff_no' }) },
      });
    }
    expect(await count(c.db, 'seva_receipts')).toBe(3);
    expect(await lastNo(c.db, 'OF1', 2026)).toBe(3);
  });

  it('after Replace this PC the new PC never reuses a label the dead PC printed but never sent', async () => {
    const c = await setup();
    const issuedAt = new Date().toISOString();
    const { yymm } = istParts(issuedAt);
    const label = (n: number): string => `G-${yymm}-OF1-${pad(n, 3)}`;

    // The old PC sent 001 and 002, printed 003 (OF number 3) and died before sending it.
    await sync(c, offlineOrder(c, { issuedAt, groupNo: label(1), receipts: [{ runningNo: 1 }] }));
    await sync(c, offlineOrder(c, { issuedAt, groupNo: label(2), receipts: [{ runningNo: 2 }] }));
    const unsent = offlineOrder(c, { issuedAt, groupNo: label(3), receipts: [{ runningNo: 3 }] });
    expect(await heartbeat(c, c.deviceId)).toMatchObject({ of_series: 'OF1', last_of_no: 2, last_of_group_no: 2 });

    // "Replace this PC": the slip in the printer said 3. The floor reserves one label per missing OF number, so the
    // new PC's first offline order is labelled 004, never 003.
    const newPc = await replaceDevice(c, 3);
    const beat = await heartbeat(c, newPc);
    expect(beat).toMatchObject({ last_of_no: 3, last_of_group_no: 3 });
    await sync(c, offlineOrder(c, { issuedAt, groupNo: label(beat.last_of_group_no + 1), receipts: [{ runningNo: 4 }] }), newPc);
    // The floor does not creep while the old PC's gap is open: the next label is 005.
    expect((await heartbeat(c, newPc)).last_of_group_no).toBe(4);

    // The old PC comes back and uploads 003: accepted inside its device_replaced gap, which it closes.
    await expect(sync(c, unsent)).resolves.toMatchObject({ duplicate: false, group_no: label(3) });
    expect(await gaps(c.db)).toEqual([{ from_no: 3, to_no: 3, cause: 'device_replaced', status: 'received_late' }]);
    expect((await heartbeat(c, newPc)).last_of_group_no).toBe(4);

    // A repeated label is still refused (group_no is unique).
    expect(
      await failure(sync(c, offlineOrder(c, { issuedAt, groupNo: label(1), receipts: [{ runningNo: 5 }] }), newPc)),
    ).toMatchObject({ code: 'number_conflict', detail: { field: 'group_no' } });
    expect(await count(c.db, 'seva_orders')).toBe(4);
  });

  it('a second replacement in the month keeps both dead PCs\' labels reserved, even once the first gap is resolved', async () => {
    const c = await setup();
    const issuedAt = new Date().toISOString();
    const { yymm } = istParts(issuedAt);
    const label = (n: number, month = yymm): string => `G-${month}-OF1-${pad(n, 3)}`;

    // PC 1 sent 001 (OF 1) and an order labelled in another month, which does not count; it printed 002 (OF 3) and died.
    await sync(c, offlineOrder(c, { issuedAt, groupNo: label(1), receipts: [{ runningNo: 1 }] }));
    await sync(c, offlineOrder(c, { issuedAt, groupNo: label(40, '2601'), receipts: [{ runningNo: 2 }] }));
    expect((await heartbeat(c, c.deviceId)).last_of_group_no).toBe(1);
    const pc2 = await replaceDevice(c, 3);
    expect((await heartbeat(c, pc2)).last_of_group_no).toBe(2);

    // PC 2 printed 003 (OF 4) and 004 (OF 5), sent nothing and died; meanwhile PC 1's slip was declared lost.
    await asRole(c.db, 'service_role', (d) =>
      d.query(
        `select seva_resolve_gap(g.id, 'declared_lost', 'Slip lost in the paper jam', $1::uuid)
           from receipt_number_gaps g where g.from_no = 3`,
        [c.staffId],
      ),
    );
    const pc3 = await replaceDevice(c, 5);
    // PC 3 starts after PC 2's labels (004), although only PC 2's gap is still open.
    expect((await heartbeat(c, pc3)).last_of_group_no).toBe(4);

    await sync(c, offlineOrder(c, { issuedAt, groupNo: label(5), receipts: [{ runningNo: 6 }] }), pc3);
    for (const [n, running] of [
      [3, 4],
      [4, 5],
    ]) {
      await expect(
        sync(c, offlineOrder(c, { issuedAt, groupNo: label(n), receipts: [{ runningNo: running }] }), pc2),
      ).resolves.toMatchObject({ duplicate: false });
    }
    expect(await count(c.db, 'seva_orders')).toBe(5);
  });

  it('stores a counter order as offline exactly when someone synced it (table check)', async () => {
    const c = await setup();
    const insert = (offline: boolean, syncedBy: string | null): Promise<unknown> =>
      c.db.query(
        `insert into seva_orders (group_no, client_order_id, channel, counter_id, issued_by_staff_id, devotee_name,
                                  receipts_count, amount_total, payment_mode, issued_offline, synced_by_staff_id, issued_at)
         values ('G-CHECK-' || $1, gen_random_uuid(), 'counter', 1, $2::uuid, 'Venkatesh Rao', 1, 105, 'cash',
                 $3::boolean, $4::uuid, now())`,
        [String(offline), c.staffId, offline, syncedBy],
      );
    await expect(insert(true, null)).rejects.toThrow(/seva_orders_counter_offline_synced/);
    await expect(insert(false, c.staffId)).rejects.toThrow(/seva_orders_(synced_by_offline|counter_offline_synced)/);
    await expect(insert(true, c.staffId)).resolves.toBeDefined();
    await expect(insert(false, null)).resolves.toBeDefined();
  });
});
