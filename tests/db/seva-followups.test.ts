/**
 * Database tests for A5-FIX F5 (20261102000200_seva_followups.sql):
 * - L-5 (rest): the counter's staff check (seva_issue_staff) refuses a view-only staff id for an online order, the
 *   outbox sync and prints, while an offline order made before its issuer became view-only still syncs.
 * - 5: an offline order naming supersedesClientOrderId cancels the unprinted in-doubt online copy, with an audit row.
 * - 2: the unprinted_online card lists C-series receipts of today with no print record after 10 minutes.
 * - 1: office-refused outbox items are noted (sync.refused) and set aside (sync.refused_set_aside); the sync_refused
 *   card lists them until they are set aside.
 * - synced_into_closed_day also counts slips entered from the paper book into a closed day.
 *
 * Every test starts from its own copy of one migrated template database; every rule is proved through the SQL
 * functions, called as service_role. Seed helpers only set the starting state.
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
  adminId: string;
  deviceId: string;
  pan: string;
  today: string;
}

interface OrderResult {
  order_id: string;
  group_no: string;
  duplicate: boolean;
  receipts: { id: string; receipt_no: string; status: string }[];
  in_closed_day?: boolean;
}

interface SevaFailure {
  code: string;
  detail: Record<string, unknown> | null;
}

interface Card {
  id: string;
  level: string;
  count: number;
  detail: Record<string, unknown>;
}

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
  const adminId = await seedStaff(db, { staffNo: 1, name: 'Temple Admin', uid: 'uid-admin' });
  const deviceId = await seedDevice(db, { staffId });
  const pan = await seedSeva(db, { code: 'PAN', nameEn: 'Panchamrutha Abhisheka', amount: '105.00', multiDate: true });
  const parts = await db.query<{ d: string }>('select p.business_date::text as d from seva_ist_parts(now()) p');
  ctx = { db, staffId, adminId, deviceId, pan, today: parts.rows[0].d };
  return ctx;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function qrToken(): string {
  return randomBytes(16).toString('base64url');
}

function addDays(date: string, days: number): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

function istParts(iso: string): { mm: string; yyyy: string; yymm: string } {
  const t = new Date(Date.parse(iso) + 330 * 60_000);
  const mm = pad(t.getUTCMonth() + 1, 2);
  const yyyy = String(t.getUTCFullYear());
  return { mm, yyyy, yymm: `${yyyy.slice(2)}${mm}` };
}

async function call<T>(c: Ctx, sql: string, params: unknown[]): Promise<T> {
  return asRole(c.db, 'service_role', async (d) => {
    const r = await d.query<{ r: T }>(sql, params);
    return r.rows[0].r;
  });
}

async function failure(p: Promise<unknown>): Promise<SevaFailure> {
  try {
    await p;
  } catch (error: unknown) {
    const e = error as { message?: string; detail?: string };
    const match = /SEVA:([a-z_]+)/.exec(e.message ?? '');
    if (!match) throw error;
    return { code: match[1], detail: e.detail ? (JSON.parse(e.detail) as Record<string, unknown>) : null };
  }
  throw new Error('expected a SEVA failure');
}

/** An online (C series) order of one PAN receipt per day offset, as the counter route sends it. */
async function issueOnline(c: Ctx, clientOrderId: string = randomUUID(), staffId: string = c.staffId, days = [0]): Promise<OrderResult> {
  const order = {
    client_order_id: clientOrderId,
    expected_total: `${105 * days.length}.00`,
    devotee: { name: 'Venkatesh Rao' },
    payment: { mode: 'cash' },
    receipts: days.map((d) => ({
      client_receipt_id: randomUUID(),
      seva_date: addDays(c.today, d),
      qr_token: qrToken(),
      lines: [{ seva_id: c.pan, quantity: 1, unit_rate: null }],
    })),
  };
  return call<OrderResult>(c, 'select seva_issue_counter_order($1::jsonb, $2::uuid, $3::uuid) as r', [
    JSON.stringify(order),
    staffId,
    c.deviceId,
  ]);
}

/**
 * An offline order exactly as toSqlOfflineOrder (lib/seva/server/counter.ts) writes it from the PC's outbox payload:
 * one PAN receipt per running number, issued by staff no. `issuer` at `issuedAt`.
 */
function offlineOrder(
  c: Ctx,
  p: { issuedAt: string; running: number[]; issuer?: number; supersedes?: string | null; clientOrderId?: string },
): Record<string, unknown> {
  const issuer = p.issuer ?? 23;
  const t = istParts(p.issuedAt);
  groupSeq += 1;
  return {
    client_order_id: p.clientOrderId ?? randomUUID(),
    supersedes_client_order_id: p.supersedes ?? null,
    expected_total: `${105 * p.running.length}.00`,
    devotee: { name: 'Venkatesh Rao', gotra: null, gotra_id: null, nakshatra_id: null, nakshatra_text: null, rashi_id: null, rashi_text: null, phone_e164: null },
    payment: { mode: 'cash', cash_received: null, upi_ref_last6: null, upi_seen_confirmed: null },
    issuer_staff_no: issuer,
    issued_at: p.issuedAt,
    group_no: `G-${t.yymm}-OF1-${pad(groupSeq, 3)}`,
    receipts: p.running.map((n, i) => ({
      client_receipt_id: randomUUID(),
      seva_date: addDays(c.today, i),
      qr_token: qrToken(),
      running_no: n,
      receipt_no: `OF1-${pad(issuer, 3)}-${t.mm}-${t.yyyy}/${pad(n, 6)}`,
      lines: [{ seva_id: c.pan, quantity: 1, unit_rate: null, change_reason: null, cached_rate: '105.00' }],
    })),
  };
}

async function sync(c: Ctx, order: Record<string, unknown>, syncerId: string = c.staffId, role = 'receptionist'): Promise<OrderResult> {
  return call<OrderResult>(c, 'select seva_sync_offline_order($1::jsonb, $2::uuid, $3::uuid, $4::text) as r', [
    JSON.stringify(order),
    syncerId,
    c.deviceId,
    role,
  ]);
}

async function prints(c: Ctx, receiptIds: string[], staffId: string = c.staffId): Promise<unknown> {
  return call<unknown>(c, 'select seva_record_prints($1::uuid[], $2::uuid, $3::uuid) as r', [
    `{${receiptIds.join(',')}}`,
    staffId,
    c.deviceId,
  ]);
}

async function setViewOnly(c: Ctx, staffId: string, viewOnly: boolean): Promise<void> {
  await asRole(c.db, 'service_role', (d) =>
    d.query(`select seva_staff_update($1::uuid, $2::jsonb, null, $3::uuid)`, [
      staffId,
      JSON.stringify({ view_only: viewOnly }),
      c.adminId,
    ]),
  );
}

async function attention(c: Ctx): Promise<Card[]> {
  const from = new Date(Date.now() - 24 * 3600_000).toISOString();
  const to = new Date(Date.now() + 3600_000).toISOString();
  return call<Card[]>(c, 'select seva_needs_attention($1::timestamptz, $2::timestamptz, $3::date) as r', [from, to, c.today]);
}

async function card(c: Ctx, id: string): Promise<Card> {
  const found = (await attention(c)).find((x) => x.id === id);
  if (!found) throw new Error(`no card ${id}`);
  return found;
}

async function count(db: PGlite, where: string): Promise<number> {
  const r = await db.query<{ n: number }>(`select count(*)::int as n from audit_log where ${where}`);
  return r.rows[0].n;
}

describe('L-5: seva_issue_staff refuses view-only staff', () => {
  it('refuses a view-only id for an online order, the outbox sync and prints; a writer still works', async () => {
    const c = await setup();
    const printed = await issueOnline(c);
    await setViewOnly(c, c.staffId, true);

    expect(await failure(issueOnline(c))).toMatchObject({ code: 'forbidden', detail: { reason: 'view_only' } });
    expect(await failure(prints(c, [printed.receipts[0].id]))).toMatchObject({ code: 'forbidden', detail: { reason: 'view_only' } });
    const now = new Date().toISOString();
    expect(await failure(sync(c, offlineOrder(c, { issuedAt: now, running: [1], issuer: 1 }), c.staffId, 'temple_admin'))).toMatchObject({
      code: 'forbidden',
      detail: { reason: 'view_only' },
    });

    await setViewOnly(c, c.staffId, false);
    await expect(prints(c, [printed.receipts[0].id])).resolves.toBeDefined();
    await expect(issueOnline(c)).resolves.toMatchObject({ duplicate: false });
  });

  it('syncs an offline order made before its issuer became view-only, and refuses one made after', async () => {
    const c = await setup();
    const before = new Date(Date.now() - 60_000).toISOString();
    await setViewOnly(c, c.staffId, true);
    const after = new Date(Date.now() + 60_000).toISOString();

    // The admin sends the outbox; Ramesh (023) printed the slip while he could still use the counter.
    await expect(sync(c, offlineOrder(c, { issuedAt: before, running: [1] }), c.adminId, 'receptionist')).resolves.toMatchObject({
      duplicate: false,
    });
    expect(await failure(sync(c, offlineOrder(c, { issuedAt: after, running: [2] }), c.adminId, 'receptionist'))).toMatchObject({
      code: 'validation',
      detail: { field: 'issuer_staff_no', reason: 'may not use the counter' },
    });
  });

  it('refuses an issuer who was view-only from the start', async () => {
    const c = await setup();
    await c.db.query('update staff set view_only = true where id = $1', [c.staffId]);
    const before = new Date(Date.now() - 3600_000).toISOString();
    expect(await failure(sync(c, offlineOrder(c, { issuedAt: before, running: [1] }), c.adminId, 'receptionist'))).toMatchObject({
      code: 'validation',
      detail: { field: 'issuer_staff_no', reason: 'may not use the counter' },
    });
  });
});

describe('5: supersedesClientOrderId end to end (H-3)', () => {
  it('an offline copy of an in-doubt online order cancels the unprinted online receipts, audited, and only once', async () => {
    const c = await setup();
    const cOrderId = randomUUID();
    // The online save reached the office but its answer never reached the PC; Save again returns the first order.
    const online = await issueOnline(c, cOrderId, c.staffId, [0, 1]);
    await expect(issueOnline(c, cOrderId, c.staffId, [0, 1])).resolves.toMatchObject({ order_id: online.order_id, duplicate: true });

    // "Yes, print offline": the outbox order names the online one, as toSqlOfflineOrder sends it.
    const order = offlineOrder(c, { issuedAt: new Date().toISOString(), running: [1, 2], supersedes: cOrderId });
    const of = await sync(c, order);
    const firstOf = of.receipts[0].receipt_no;

    const old = await c.db.query<{ status: string; cancel_reason_code: string; cancel_note: string }>(
      `select status, cancel_reason_code, cancel_note from seva_receipts where order_id = $1 order by position`,
      [online.order_id],
    );
    expect(old.rows).toEqual(
      [0, 1].map(() => ({
        status: 'cancelled',
        cancel_reason_code: 'not_printed_connection_lost',
        cancel_note: `Not printed: connection lost before the reply; reissued offline as ${firstOf}`,
      })),
    );
    const link = await c.db.query('select supersedes_order_id from seva_orders where id = $1', [of.order_id]);
    expect(link.rows).toEqual([{ supersedes_order_id: online.order_id }]);
    const audit = await c.db.query<{ entity_id: string; actor_staff_id: string; after: Record<string, unknown> }>(
      `select entity_id, actor_staff_id, after from audit_log where action = 'receipt.superseded' order by id`,
    );
    expect(audit.rows.map((r) => r.entity_id)).toEqual(online.receipts.map((r) => r.id));
    expect(audit.rows[0]).toMatchObject({
      actor_staff_id: c.staffId,
      after: { status: 'cancelled', superseded_by_order_id: of.order_id, superseded_by_receipt_no: firstOf },
    });
    // Nothing is left counted twice, so the possible-duplicates card is calm.
    expect(await card(c, 'in_doubt_duplicates')).toMatchObject({ level: 'ok', count: 0 });

    // The outbox sending the same item again (a lost answer) changes nothing.
    await expect(sync(c, order)).resolves.toMatchObject({ order_id: of.order_id, duplicate: true });
    expect(await count(c.db, `action = 'receipt.superseded'`)).toBe(2);
  });
});

/** Test set-up only: moves a receipt back in time (the receipt guard forbids it, so triggers are off for the update). */
async function backdate(c: Ctx, receiptId: string, minutes: number, businessDate?: string): Promise<void> {
  await c.db.exec('SET session_replication_role = replica');
  try {
    await c.db.query(
      `update seva_receipts set issued_at = issued_at - make_interval(mins => $2::int),
                                business_date = coalesce($3::date, business_date)
        where id = $1`,
      [receiptId, minutes, businessDate ?? null],
    );
  } finally {
    await c.db.exec('RESET session_replication_role');
  }
}

describe('2: unprinted_online card', () => {
  it('lists online receipts of the last 7 business days with no print record after 10 minutes (FINAL-FIX N-3)', async () => {
    const c = await setup();
    expect(await card(c, 'unprinted_online')).toMatchObject({ level: 'ok', count: 0 });

    const unprinted = await issueOnline(c, randomUUID(), c.staffId, [0, 1]);
    const printed = await issueOnline(c);
    const fresh = await issueOnline(c);
    const cancelled = await issueOnline(c);
    const yesterday = await issueOnline(c);
    const weekAgo = await issueOnline(c);
    const tooOld = await issueOnline(c);
    for (const r of [...unprinted.receipts, ...printed.receipts, ...cancelled.receipts]) await backdate(c, r.id, 11);
    // N-3: an in-doubt order of an earlier day stays on the card for 7 business days, then drops off.
    await backdate(c, yesterday.receipts[0].id, 1440 + 11, addDays(c.today, -1));
    await backdate(c, weekAgo.receipts[0].id, 7 * 1440 + 11, addDays(c.today, -7));
    await backdate(c, tooOld.receipts[0].id, 8 * 1440 + 11, addDays(c.today, -8));
    await prints(c, [printed.receipts[0].id]);
    await call<unknown>(
      c,
      `select seva_cancel_receipts($1::uuid[], 'wrong_seva', null, $2::uuid, true, null, null, null, $3::uuid) as r`,
      [`{${cancelled.receipts[0].id}}`, c.adminId, c.deviceId],
    );
    // An offline receipt is printed on the PC before it is sent; it never counts here.
    await sync(c, offlineOrder(c, { issuedAt: new Date(Date.now() - 20 * 60_000).toISOString(), running: [1] }));

    const got = await card(c, 'unprinted_online');
    expect(got).toMatchObject({ level: 'attention', count: 4 });
    expect(got.detail.receipts).toBe(
      [weekAgo.receipts[0], yesterday.receipts[0], ...unprinted.receipts].map((r) => r.receipt_no).join(', '),
    );
    expect(got.detail.oldest_at).toEqual(expect.any(String));
    expect(fresh.receipts).toHaveLength(1);

    // Printing them clears the card.
    await prints(c, [...unprinted.receipts, yesterday.receipts[0], weekAgo.receipts[0]].map((r) => r.id));
    expect(await card(c, 'unprinted_online')).toMatchObject({ level: 'ok', count: 0 });
    expect(tooOld.receipts).toHaveLength(1);
  });
});

describe('synced_into_closed_day counts paper-book entries into a closed day', () => {
  /** An open OF1 gap 5..6 of this year, written as a fixture; answers its id. */
  async function openGap(c: Ctx): Promise<number> {
    await c.db.query(
      `insert into receipt_series_years (series_code, year, last_no)
       select 'OF1', p.year, 9 from seva_ist_parts(now()) p
       on conflict (series_code, year) do update set last_no = greatest(receipt_series_years.last_no, 9)`,
    );
    const r = await c.db.query<{ id: number }>(
      `insert into receipt_number_gaps (series_code, year, from_no, to_no, cause)
       select 'OF1', p.year, 5, 6, 'missing_in_sync' from seva_ist_parts(now()) p returning id::int as id`,
    );
    return r.rows[0].id;
  }

  async function enterSlip(c: Ctx, gapId: number, running: number): Promise<void> {
    const t = istParts(new Date().toISOString());
    await call<unknown>(c, 'select seva_enter_paper_receipt($1::bigint, $2::jsonb, $3::uuid) as r', [
      gapId,
      JSON.stringify({
        receipt_no: `OF1-023-${t.mm}-${t.yyyy}/${pad(running, 6)}`,
        issued_on: c.today,
        seva_date: c.today,
        devotee: { name: 'Lakshmi Narayan' },
        lines: [{ seva_id: c.pan, quantity: 1, unit_rate: null }],
        expected_total: '105.00',
        payment: { mode: 'cash' },
        qr_token: qrToken(),
        note: 'Paper receipt book, page 12',
      }),
      c.adminId,
    ]);
  }

  it('a slip entered into a closed counter-day counts on the card with its amount; one into an open day does not', async () => {
    const c = await setup();
    const gap = await openGap(c);
    await enterSlip(c, gap, 5);
    expect(await card(c, 'synced_into_closed_day')).toMatchObject({ level: 'ok', count: 0 });

    await c.db.query(
      `insert into day_closes (counter_id, business_date, status, cash_expected, cash_counted, series_ranges,
                               outbox_pending, closed_by_staff_id, closed_at)
       values (1, $1::date, 'closed', 0, 0, '[]'::jsonb, 0, $2::uuid, now())`,
      [c.today, c.adminId],
    );
    await enterSlip(c, gap, 6);
    expect(await count(c.db, `action = 'receipt.entered_from_paper' and after ->> 'in_closed_day' = 'true'`)).toBe(1);
    expect(await card(c, 'synced_into_closed_day')).toMatchObject({
      level: 'critical',
      count: 1,
      detail: { amount: '105.00', oldest_date: c.today },
    });
  });
});

describe('1: office-refused outbox items are reported and listed until set aside', () => {
  function refusal(seq: number, over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      seq,
      kind: 'order',
      code: 'validation',
      receipt_nos: [`OF1-023-10-2026/${pad(seq, 6)}`],
      total: '105.00',
      refused_at: new Date().toISOString(),
      ...over,
    };
  }

  function note(c: Ctx, item: Record<string, unknown>, staffId: string = c.staffId, deviceId: string = c.deviceId): Promise<{ duplicate: boolean }> {
    return call(c, 'select seva_note_sync_refused($1::uuid, $2::jsonb, $3::uuid) as r', [deviceId, JSON.stringify(item), staffId]);
  }

  function setAside(c: Ctx, item: Record<string, unknown>, staffId: string = c.adminId): Promise<{ duplicate: boolean }> {
    return call(c, 'select seva_note_refused_set_aside($1::uuid, $2::jsonb, $3::uuid) as r', [c.deviceId, JSON.stringify(item), staffId]);
  }

  it('writes one sync.refused row per item with the receipt numbers, the code and the PC; a repeat is a duplicate', async () => {
    const c = await setup();
    expect(await card(c, 'sync_refused')).toMatchObject({ level: 'ok', count: 0 });

    await expect(note(c, refusal(4, { receipt_nos: ['OF1-023-10-2026/000004', 'OF1-023-10-2026/000005'], total: '210.00' }))).resolves.toEqual({
      duplicate: false,
    });
    await expect(note(c, refusal(4))).resolves.toEqual({ duplicate: true });
    await note(c, refusal(9, { kind: 'cancel', code: 'cancel_window_passed', total: '105.00' }));

    const rows = await c.db.query<{ entity: string; entity_id: string; receipt_no: string; reason: string; actor_staff_id: string; after: Record<string, unknown> }>(
      `select entity, entity_id, receipt_no, reason, actor_staff_id, after from audit_log where action = 'sync.refused' order by id`,
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0]).toMatchObject({
      entity: 'outbox_item',
      entity_id: `${c.deviceId}:4`,
      receipt_no: 'OF1-023-10-2026/000004',
      reason: 'validation',
      actor_staff_id: c.staffId,
      after: {
        device_id: c.deviceId,
        device_label: 'Test PC',
        counter_id: 1,
        seq: 4,
        kind: 'order',
        code: 'validation',
        receipt_nos: ['OF1-023-10-2026/000004', 'OF1-023-10-2026/000005'],
        total: '210.00',
      },
    });

    expect(await card(c, 'sync_refused')).toMatchObject({
      level: 'critical',
      count: 2,
      detail: { receipts: 'OF1-023-10-2026/000004, OF1-023-10-2026/000005, OF1-023-10-2026/000009', amount: '315.00' },
    });
  });

  it('a set-aside on the PC is recorded with its reason and takes the item off the card', async () => {
    const c = await setup();
    await note(c, refusal(4));
    await note(c, refusal(5));

    expect(await failure(setAside(c, { ...refusal(4), reason: '  ', set_aside_at: new Date().toISOString() }))).toMatchObject({
      code: 'validation',
      detail: { field: 'reason' },
    });
    await expect(setAside(c, { ...refusal(4), reason: 'Entered in the paper book p.14', set_aside_at: new Date().toISOString() })).resolves.toEqual({
      duplicate: false,
    });
    await expect(setAside(c, { ...refusal(4), reason: 'Entered in the paper book p.14', set_aside_at: new Date().toISOString() })).resolves.toEqual({
      duplicate: true,
    });
    const row = await c.db.query<{ entity_id: string; reason: string; actor_staff_id: string; after: Record<string, unknown> }>(
      `select entity_id, reason, actor_staff_id, after from audit_log where action = 'sync.refused_set_aside'`,
    );
    expect(row.rows).toEqual([
      expect.objectContaining({
        entity_id: `${c.deviceId}:4`,
        reason: 'Entered in the paper book p.14',
        actor_staff_id: c.adminId,
        after: expect.objectContaining({ seq: 4, code: 'validation', receipt_nos: ['OF1-023-10-2026/000004'] }),
      }),
    ]);
    expect(await card(c, 'sync_refused')).toMatchObject({ count: 1, detail: { receipts: 'OF1-023-10-2026/000005' } });

    // A set-aside whose refusal never reached the office records the refusal first, so nothing goes unseen.
    await setAside(c, { ...refusal(7), reason: 'Entered in the paper book p.15', set_aside_at: new Date().toISOString() });
    expect(await count(c.db, `action = 'sync.refused' and entity_id = '${c.deviceId}:7'`)).toBe(1);
    expect(await card(c, 'sync_refused')).toMatchObject({ count: 1 });
  });

  it('refuses a view-only staff id, a bad item and an unknown PC', async () => {
    const c = await setup();
    await setViewOnly(c, c.staffId, true);
    expect(await failure(note(c, refusal(1)))).toMatchObject({ code: 'forbidden', detail: { reason: 'view_only' } });
    expect(await failure(note(c, refusal(1, { seq: 0 }), c.adminId))).toMatchObject({ code: 'validation', detail: { field: 'seq' } });
    expect(await failure(note(c, refusal(1, { kind: 'payment' }), c.adminId))).toMatchObject({ code: 'validation', detail: { field: 'kind' } });
    expect(await failure(note(c, refusal(1, { code: 'Not A Code!' }), c.adminId))).toMatchObject({ code: 'validation', detail: { field: 'code' } });
    expect(await failure(note(c, refusal(1, { receipt_nos: 'x' }), c.adminId))).toMatchObject({ code: 'validation', detail: { field: 'receipt_nos' } });
    expect(await failure(note(c, refusal(1), c.adminId, randomUUID()))).toMatchObject({ code: 'device_unknown' });
    expect(await failure(setAside(c, { ...refusal(1), reason: 'Paper book', set_aside_at: new Date().toISOString() }, c.staffId))).toMatchObject({
      code: 'forbidden',
    });
  });
});

describe('3: closing the day with the counter offline needs an admin reason', () => {
  function closeDay(c: Ctx, ok: boolean, reason: string | null): Promise<string> {
    return call<string>(
      c,
      `select seva_close_day(1::smallint, $1::date, '[]'::jsonb, null, 'Counted with the office', $2::uuid, $3::boolean, $4) as r`,
      [c.today, c.adminId, ok, reason],
    );
  }

  it('refuses without the override, asks for a reason with it, and audits the reason', async () => {
    const c = await setup();
    await c.db.query(`update counter_devices set last_seen_at = now() - interval '5 minutes' where id = $1`, [c.deviceId]);

    expect(await failure(closeDay(c, false, null))).toMatchObject({ code: 'outbox_not_empty', detail: { reason: 'counter_not_seen' } });
    expect(await failure(closeDay(c, true, null))).toMatchObject({ code: 'validation', detail: { field: 'counter_offline_reason' } });
    expect(await failure(closeDay(c, true, ' ​ '))).toMatchObject({ code: 'validation', detail: { field: 'counter_offline_reason' } });

    const id = await closeDay(c, true, 'Counter PC switched off; nothing left on it');
    const audit = await c.db.query<{ after: Record<string, unknown> }>(
      `select after from audit_log where action = 'dayclose.close' and entity_id = $1`,
      [id],
    );
    expect(audit.rows[0].after).toMatchObject({
      counter_offline_override: true,
      counter_offline_reason: 'Counter PC switched off; nothing left on it',
    });
  });

  it('needs no reason when the counter PC was seen in time, and a six-argument call still works', async () => {
    const c = await setup();
    await c.db.query(`update counter_devices set last_seen_at = now() where id = $1`, [c.deviceId]);
    await expect(
      call<string>(c, `select seva_close_day(1::smallint, $1::date, '[]'::jsonb, null, 'Counted with the office', $2::uuid) as r`, [
        c.today,
        c.adminId,
      ]),
    ).resolves.toEqual(expect.any(String));
  });
});
