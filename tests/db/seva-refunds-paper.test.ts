/**
 * Database tests for A5-FIX F4 (20261102000100_seva_refunds_paper.sql):
 * - M-3: an admin marks a refund-due receipt as refunded (seva_settle_refund) with the mode, a reference and a note;
 *   the receipt's refund_state becomes done, a receipt.refund_done audit row is written and the "UPI refunds due"
 *   card clears.
 * - M-6: an admin enters a receipt of an open number gap from the paper book (seva_enter_paper_receipt); the gap
 *   shrinks with every number entered and closes as entered_from_paper only when its last number is entered.
 *   seva_resolve_gap no longer closes a gap as entered_from_paper while its receipts are missing.
 *
 * Every test starts from its own copy of one migrated template database; every rule is proved through the SQL
 * functions, called as service_role.
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
  viewerId: string;
  deviceId: string;
  pan: string;
  today: string;
}

interface SevaFailure {
  code: string;
  detail: Record<string, unknown> | null;
}

interface Card {
  id: string;
  level: string;
  count: number;
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

async function setup(): Promise<Ctx> {
  const db = await PGlite.create({ loadDataDir: template, extensions: { uuid_ossp, pgcrypto } });
  const staffId = await seedStaff(db, { staffNo: 23, name: 'Ramesh', uid: 'uid-ramesh' });
  const adminId = await seedStaff(db, { staffNo: 1, name: 'Temple Admin', uid: 'uid-admin' });
  const viewerId = await seedStaff(db, { staffNo: 2, name: 'Viewer', uid: 'uid-viewer' });
  await db.query(`update staff set view_only = true where id = $1`, [viewerId]);
  const deviceId = await seedDevice(db, { staffId });
  const pan = await seedSeva(db, { code: 'PAN', nameEn: 'Panchamrutha Abhisheka', amount: '105.00' });
  const parts = await db.query<{ d: string }>(`select p.business_date::text as d from seva_ist_parts(now()) p`);
  ctx = { db, staffId, adminId, viewerId, deviceId, pan, today: parts.rows[0].d };
  return ctx;
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

function qrToken(): string {
  return randomBytes(16).toString('base64url');
}

/** A one-receipt PAN order of today at Counter 1, issued online by Ramesh; answers the receipt id. */
async function issue(c: Ctx, mode: 'cash' | 'upi'): Promise<string> {
  const order = {
    client_order_id: randomUUID(),
    expected_total: '105.00',
    devotee: { name: 'Venkatesh Rao' },
    payment: mode === 'upi' ? { mode: 'upi', upi_ref_last6: '119042', upi_seen_confirmed: true } : { mode: 'cash' },
    receipts: [{ client_receipt_id: randomUUID(), seva_date: c.today, qr_token: qrToken(), lines: [{ seva_id: c.pan, quantity: 1, unit_rate: null }] }],
  };
  return asRole(c.db, 'service_role', async (d) => {
    const r = await d.query<{ r: { receipts: { id: string }[] } }>(
      'select seva_issue_counter_order($1::jsonb, $2::uuid, $3::uuid) as r',
      [JSON.stringify(order), c.staffId, c.deviceId],
    );
    return r.rows[0].r.receipts[0].id;
  });
}

/** An admin cancel: a UPI receipt becomes refund due (C-20). */
async function adminCancel(c: Ctx, ids: string[]): Promise<void> {
  await asRole(c.db, 'service_role', (d) =>
    d.query('select seva_cancel_receipts($1::uuid[], $2, $3, $4::uuid, true)', [ids, 'changed_mind', null, c.adminId]),
  );
}

function settle(
  c: Ctx,
  p: { ids: string[]; mode?: string | null; reference?: string | null; note?: string | null; staffId?: string },
): Promise<{ receipts: { id: string; receipt_no: string; refund_state: string; refund_note: string }[]; refunded_total: string }> {
  return asRole(c.db, 'service_role', async (d) => {
    const r = await d.query<{
      r: { receipts: { id: string; receipt_no: string; refund_state: string; refund_note: string }[]; refunded_total: string };
    }>('select seva_settle_refund($1::uuid[], $2, $3, $4, $5::uuid) as r', [
      p.ids,
      p.mode === undefined ? 'upi' : p.mode,
      p.reference === undefined ? '402911' : p.reference,
      p.note === undefined ? 'Refunded from the bank app' : p.note,
      p.staffId ?? c.adminId,
    ]);
    return r.rows[0].r;
  });
}

async function refundDueCard(c: Ctx): Promise<Card | undefined> {
  const cards = await asRole(c.db, 'service_role', async (d) =>
    (
      await d.query<{ cards: Card[] }>(
        `select seva_needs_attention(now() - interval '1 hour', now() + interval '1 hour', $1::date) as cards`,
        [c.today],
      )
    ).rows[0].cards,
  );
  return cards.find((x) => x.id === 'upi_refunds_due');
}

describe('M-3: seva_settle_refund marks a refund-due receipt as refunded', () => {
  it('refuses a blank note, an unknown mode, a missing reference for UPI and a view-only admin', async () => {
    const c = await setup();
    const receipt = await issue(c, 'upi');
    await adminCancel(c, [receipt]);

    expect(await failure(settle(c, { ids: [receipt], note: '  ' }))).toMatchObject({ code: 'validation', detail: { field: 'note' } });
    expect(await failure(settle(c, { ids: [receipt], note: 'ok' }))).toMatchObject({ code: 'validation', detail: { field: 'note' } });
    expect(await failure(settle(c, { ids: [receipt], note: '​​​' }))).toMatchObject({
      code: 'validation',
      detail: { field: 'note' },
    });
    expect(await failure(settle(c, { ids: [receipt], mode: 'cheque' }))).toMatchObject({ code: 'validation', detail: { field: 'mode' } });
    expect(await failure(settle(c, { ids: [receipt], reference: null }))).toMatchObject({
      code: 'validation',
      detail: { field: 'reference' },
    });
    expect(await failure(settle(c, { ids: [receipt], staffId: c.viewerId }))).toMatchObject({
      code: 'forbidden',
      detail: { reason: 'view_only' },
    });
    expect(await failure(settle(c, { ids: [] }))).toMatchObject({ code: 'validation', detail: { field: 'receipt_ids' } });
    expect(await failure(settle(c, { ids: [randomUUID()] }))).toMatchObject({ code: 'not_found' });

    const row = await c.db.query<{ refund_state: string }>(`select refund_state from seva_receipts where id = $1`, [receipt]);
    expect(row.rows[0].refund_state).toBe('due');
  });

  it('refuses a receipt whose refund is not due: still issued, or handed back from the drawer', async () => {
    const c = await setup();
    const issued = await issue(c, 'upi');
    const cash = await issue(c, 'cash');
    await adminCancel(c, [cash]); // same-day cash: handed back, refund_state done

    expect(await failure(settle(c, { ids: [issued] }))).toMatchObject({
      code: 'validation',
      detail: { field: 'receipt_ids', reason: 'not_refund_due' },
    });
    expect(await failure(settle(c, { ids: [cash] }))).toMatchObject({
      code: 'validation',
      detail: { field: 'receipt_ids', reason: 'not_refund_due' },
    });
  });

  it('a valid settle sets done with the mode, reference and note, writes receipt.refund_done and clears the card', async () => {
    const c = await setup();
    const first = await issue(c, 'upi');
    const second = await issue(c, 'upi');
    await adminCancel(c, [first, second]);
    expect(await refundDueCard(c)).toMatchObject({ level: 'attention', count: 2 });

    const answer = await settle(c, { ids: [first, second, first], reference: ' UTR 6021 1904 ', note: 'Paid back from the bank app' });
    expect(answer.refunded_total).toBe('210.00');
    expect(answer.receipts.map((r) => [r.id, r.refund_state])).toEqual(
      expect.arrayContaining([
        [first, 'done'],
        [second, 'done'],
      ]),
    );
    expect(answer.receipts).toHaveLength(2);

    const rows = await c.db.query<{ refund_state: string; refund_note: string }>(
      `select refund_state, refund_note from seva_receipts where id = $1`,
      [first],
    );
    expect(rows.rows[0]).toEqual({ refund_state: 'done', refund_note: 'Refunded by UPI, ref UTR 6021 1904: Paid back from the bank app' });

    const audit = await c.db.query<{ action: string; entity_id: string; actor_staff_id: string; reason: string; before: unknown; after: unknown }>(
      `select action, entity_id, actor_staff_id, reason, before, after from audit_log where action = 'receipt.refund_done' order by id`,
    );
    expect(audit.rows).toHaveLength(2);
    expect(audit.rows[0]).toMatchObject({
      action: 'receipt.refund_done',
      actor_staff_id: c.adminId,
      reason: 'Paid back from the bank app',
      before: { refund_state: 'due' },
      after: { refund_state: 'done', mode: 'upi', reference: 'UTR 6021 1904', amount: '105.00' },
    });

    expect(await refundDueCard(c)).toMatchObject({ level: 'ok', count: 0 });

    // Settled once: a second try is refused, nothing changes.
    expect(await failure(settle(c, { ids: [first] }))).toMatchObject({
      code: 'validation',
      detail: { field: 'receipt_ids', reason: 'not_refund_due' },
    });
  });

  it('a cash refund needs no reference', async () => {
    const c = await setup();
    const receipt = await issue(c, 'upi');
    await adminCancel(c, [receipt]);
    const answer = await settle(c, { ids: [receipt], mode: 'cash', reference: null, note: 'Handed over at the office' });
    expect(answer.receipts[0]).toMatchObject({ refund_state: 'done', refund_note: 'Refunded in cash: Handed over at the office' });
  });

  it('only service_role may call it', async () => {
    const c = await setup();
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(
        asRole(c.db, role, (d) => d.query('select seva_settle_refund($1::uuid[], $2, $3, $4, $5::uuid)', [[randomUUID()], 'upi', 'x', 'note', c.adminId])),
      ).rejects.toThrow(/permission denied/);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// M-6: entering a gap's receipts from the paper book
// ---------------------------------------------------------------------------------------------------------------

interface Gap {
  id: number;
  from_no: number;
  to_no: number;
  status: string;
  resolution_note: string | null;
  resolved_by_staff_id: string | null;
}

interface PaperAnswer {
  order_id: string;
  group_no: string;
  receipts: { id: string; receipt_no: string; total: string; status: string }[];
  gap_status: string;
}

/** An open OF1 gap (default 5..7) of this year, OF1 having handed out up to 9, written as a fixture; answers its id. */
async function openGap(c: Ctx, from = 5, to = 7): Promise<number> {
  await c.db.query(
    `insert into receipt_series_years (series_code, year, last_no)
     select 'OF1', p.year, 9 from seva_ist_parts(now()) p
     on conflict (series_code, year) do update set last_no = greatest(receipt_series_years.last_no, 9)`,
  );
  const r = await c.db.query<{ id: number }>(
    `insert into receipt_number_gaps (series_code, year, from_no, to_no, cause)
     select 'OF1', p.year, $1::int, $2::int, 'missing_in_sync' from seva_ist_parts(now()) p
     returning id::int as id`,
    [from, to],
  );
  return r.rows[0].id;
}

async function gapRows(c: Ctx): Promise<Gap[]> {
  const r = await c.db.query<Gap>(
    `select id::int as id, from_no, to_no, status, resolution_note, resolved_by_staff_id
       from receipt_number_gaps order by from_no`,
  );
  return r.rows;
}

/** The paper slip's number for OF1 and this IST month, e.g. 'OF1-023-10-2026/000006'. */
async function paperNo(c: Ctx, running: number, staffNo = 23): Promise<string> {
  const r = await c.db.query<{ no: string }>(
    `select 'OF1-' || lpad($2::text, 3, '0') || '-' || lpad(p.month::text, 2, '0') || '-' || p.year::text || '/'
            || lpad($1::text, 6, '0') as no
       from seva_ist_parts(now()) p`,
    [running, staffNo],
  );
  return r.rows[0].no;
}

async function slip(c: Ctx, running: number, over: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  return {
    receipt_no: await paperNo(c, running),
    issued_on: c.today,
    seva_date: c.today,
    devotee: { name: 'Lakshmi Narayan', phone_e164: '+919845012345' },
    lines: [{ seva_id: c.pan, quantity: 1, unit_rate: null }],
    expected_total: '105.00',
    payment: { mode: 'cash' },
    qr_token: qrToken(),
    note: 'Paper receipt book, page 12',
    ...over,
  };
}

function enter(c: Ctx, gapId: number, body: Record<string, unknown>, staffId: string = c.adminId): Promise<PaperAnswer> {
  return asRole(c.db, 'service_role', async (d) => {
    const r = await d.query<{ r: PaperAnswer }>('select seva_enter_paper_receipt($1::bigint, $2::jsonb, $3::uuid) as r', [
      gapId,
      JSON.stringify(body),
      staffId,
    ]);
    return r.rows[0].r;
  });
}

function resolveGap(c: Ctx, gapId: number, status: string, note: string): Promise<unknown> {
  return asRole(c.db, 'service_role', (d) =>
    d.query('select seva_resolve_gap($1::bigint, $2, $3, $4::uuid)', [gapId, status, note, c.adminId]),
  );
}

describe('M-6: seva_enter_paper_receipt enters a gap receipt from the paper book', () => {
  it('a gap cannot be resolved as entered_from_paper while its receipts are missing; declared lost still works', async () => {
    const c = await setup();
    const gap = await openGap(c);
    expect(await failure(resolveGap(c, gap, 'entered_from_paper', 'Typed in from paper'))).toMatchObject({
      code: 'validation',
      detail: { field: 'status', reason: 'receipts_missing' },
    });
    expect((await gapRows(c))[0]).toMatchObject({ status: 'open' });

    await resolveGap(c, gap, 'declared_lost', 'Book lost in the rain');
    expect((await gapRows(c))[0]).toMatchObject({ status: 'declared_lost' });
  });

  it('stores the receipt with its paper number; the gap shrinks and closes only when every number is entered', async () => {
    const c = await setup();
    const gap = await openGap(c);

    const middle = await enter(c, gap, await slip(c, 6));
    expect(middle.gap_status).toBe('open');
    expect(middle.receipts).toEqual([expect.objectContaining({ receipt_no: await paperNo(c, 6), total: '105.00', status: 'issued' })]);
    expect((await gapRows(c)).map((g) => [g.from_no, g.to_no, g.status])).toEqual([
      [5, 5, 'open'],
      [7, 7, 'open'],
    ]);

    const stored = await c.db.query<Record<string, unknown>>(
      `select r.series_code, r.running_no, r.staff_no, r.business_date::text as business_date, r.issued_offline,
              r.issued_by_staff_id, r.prasadam_state, o.channel, o.counter_id, o.synced_by_staff_id, o.payment_mode,
              o.devotee_name
         from seva_receipts r join seva_orders o on o.id = r.order_id
        where r.receipt_no = $1`,
      [await paperNo(c, 6)],
    );
    expect(stored.rows[0]).toEqual({
      series_code: 'OF1',
      running_no: 6,
      staff_no: 23,
      business_date: c.today,
      issued_offline: true,
      issued_by_staff_id: c.staffId,
      prasadam_state: 'pending',
      channel: 'counter',
      counter_id: 1,
      synced_by_staff_id: c.adminId,
      payment_mode: 'cash',
      devotee_name: 'Lakshmi Narayan',
    });

    const audit = await c.db.query<{ action: string; actor_staff_id: string; reason: string; after: Record<string, unknown> }>(
      `select action, actor_staff_id, reason, after from audit_log where action = 'receipt.entered_from_paper'`,
    );
    expect(audit.rows).toEqual([
      expect.objectContaining({
        actor_staff_id: c.adminId,
        reason: 'Paper receipt book, page 12',
        after: expect.objectContaining({ gap_id: gap, running_no: 6, issuer_staff_no: 23, total: '105.00', in_closed_day: false }),
      }),
    ]);

    const [left, right] = await gapRows(c);
    expect((await enter(c, left.id, await slip(c, 5))).gap_status).toBe('entered_from_paper');
    expect((await enter(c, right.id, await slip(c, 7, { payment: { mode: 'upi', upi_ref_last6: '550912' } }))).gap_status).toBe(
      'entered_from_paper',
    );
    expect(await gapRows(c)).toEqual([
      expect.objectContaining({
        from_no: 5,
        to_no: 5,
        status: 'entered_from_paper',
        resolution_note: 'Paper receipt book, page 12',
        resolved_by_staff_id: c.adminId,
      }),
      expect.objectContaining({ from_no: 7, to_no: 7, status: 'entered_from_paper', resolved_by_staff_id: c.adminId }),
    ]);
    const continuity = await asRole(c.db, 'service_role', async (d) =>
      (
        await d.query<{ open_gaps: number; issued: number }>(
          `select open_gaps, issued from seva_continuity($1::date, $1::date) where series_code = 'OF1'`,
          [c.today],
        )
      ).rows[0],
    );
    expect(continuity).toMatchObject({ open_gaps: 0, issued: 3 });
  });

  it('marks a printed amount that differs from the catalogue as changed, with the paper-book reason', async () => {
    const c = await setup();
    const gap = await openGap(c, 6, 6);
    await enter(c, gap, await slip(c, 6, { lines: [{ seva_id: c.pan, quantity: 2, unit_rate: '150.00' }], expected_total: '300.00' }));
    const line = await c.db.query<{ catalogue_rate: string; unit_rate: string; change_reason: string; has_changed_amount: boolean }>(
      `select l.catalogue_rate::text, l.unit_rate::text, l.change_reason, r.has_changed_amount
         from seva_receipt_lines l join seva_receipts r on r.id = l.receipt_id`,
    );
    expect(line.rows[0]).toEqual({
      catalogue_rate: '105.00',
      unit_rate: '150.00',
      change_reason: 'Entered from the paper book: printed 150.00, catalogue 105.00',
      has_changed_amount: true,
    });
  });

  it('refuses a number outside the gap, a wrong number, a mismatched date or total, a short note, a used gap and a view-only admin', async () => {
    const c = await setup();
    const gap = await openGap(c);

    expect(await failure(enter(c, gap, await slip(c, 8)))).toMatchObject({ code: 'validation', detail: { field: 'receipt_no', reason: 'outside_gap' } });
    expect(await failure(enter(c, gap, await slip(c, 6, { receipt_no: 'C1-023-10-2026/000006' })))).toMatchObject({
      code: 'validation',
      detail: { field: 'receipt_no' },
    });
    expect(await failure(enter(c, gap, await slip(c, 6, { receipt_no: await paperNo(c, 6, 999) })))).toMatchObject({
      code: 'validation',
      detail: { field: 'receipt_no', reason: 'unknown_staff_no' },
    });
    expect(await failure(enter(c, gap, await slip(c, 6, { receipt_no: 'OF1-023-13-2026/000006' })))).toMatchObject({
      code: 'validation',
      detail: { field: 'receipt_no' },
    });
    // The month in the number must be the month of the date on the slip: the last day of the month before is refused.
    const monthBefore = new Date(`${c.today}T00:00:00Z`);
    monthBefore.setUTCDate(0);
    expect(await failure(enter(c, gap, await slip(c, 6, { issued_on: monthBefore.toISOString().slice(0, 10) })))).toMatchObject({
      code: 'validation',
      detail: { field: 'issued_on' },
    });
    expect(await failure(enter(c, gap, await slip(c, 6, { issued_on: '2999-01-01' })))).toMatchObject({
      code: 'validation',
      detail: { field: 'issued_on' },
    });
    expect(await failure(enter(c, gap, await slip(c, 6, { expected_total: '100.00' })))).toMatchObject({
      code: 'validation',
      detail: { field: 'expected_total' },
    });
    expect(await failure(enter(c, gap, await slip(c, 6, { note: ' ​ ' })))).toMatchObject({ code: 'validation', detail: { field: 'note' } });
    expect(await failure(enter(c, gap, await slip(c, 6, { payment: { mode: 'upi' } })))).toMatchObject({ code: 'upi_details_required' });
    expect(await failure(enter(c, gap, await slip(c, 6), c.viewerId))).toMatchObject({ code: 'forbidden', detail: { reason: 'view_only' } });
    expect(await failure(enter(c, 999999, await slip(c, 6)))).toMatchObject({ code: 'not_found' });

    // No refusal stored anything.
    expect((await c.db.query(`select 1 from seva_receipts`)).rows).toHaveLength(0);
    expect((await gapRows(c)).map((g) => [g.from_no, g.to_no, g.status])).toEqual([[5, 7, 'open']]);

    await resolveGap(c, gap, 'declared_lost', 'Book lost in the rain');
    expect(await failure(enter(c, gap, await slip(c, 6)))).toMatchObject({
      code: 'validation',
      detail: { field: 'gap', reason: 'already_resolved' },
    });
  });

  it('only service_role may call it', async () => {
    const c = await setup();
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(
        asRole(c.db, role, (d) => d.query('select seva_enter_paper_receipt($1::bigint, $2::jsonb, $3::uuid)', [1, '{}', c.adminId])),
      ).rejects.toThrow(/permission denied/);
    }
  });
});
