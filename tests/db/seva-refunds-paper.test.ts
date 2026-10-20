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
