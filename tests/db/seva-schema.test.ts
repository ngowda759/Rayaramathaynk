import fs from 'fs';
import { randomBytes } from 'crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { applyMigrationFile, asRole, freshDb, sevaMigrationFiles } from './harness';
import { seedDevice, seedSeva, seedStaff } from './fixtures';

const SEVA_TABLES = [
  'staff',
  'counters',
  'counter_devices',
  'receipt_series',
  'receipt_series_years',
  'receipt_number_gaps',
  'group_counters',
  'seva_settings',
  'cash_denominations',
  'festival_days',
  'festival_day_dates',
  'seva_rate_history',
  'audit_log',
  'ops_backup_runs',
  'seva_orders',
  'seva_receipts',
  'seva_receipt_lines',
  'day_closes',
  'day_close_counts',
  'devotee_profiles',
] as const;

const IDENTITY_TABLES = [
  'seva_rate_history',
  'audit_log',
  'ops_backup_runs',
  'cash_denominations',
  'receipt_number_gaps',
] as const;

const A1_FILES = [
  '20261020000000_seva_core.sql',
  '20261020000100_seva_receipts.sql',
  '20261020000200_seva_seed.sql',
] as const;

const SEED_FILE = '20261020000200_seva_seed.sql';

const TABLE_LIST_SQL = SEVA_TABLES.map((t) => `'${t}'`).join(', ');

function readSeedSql(): string {
  return fs.readFileSync(new URL(`../../supabase/migrations/${SEED_FILE}`, import.meta.url), 'utf8');
}

function qrToken(): string {
  return randomBytes(16).toString('base64url');
}

let nextStaffNo = 100;
let nextRunningNo = 1;
let nextGroupNo = 1;

async function newStaff(db: PGlite): Promise<{ id: string; staffNo: number }> {
  const staffNo = nextStaffNo++;
  const id = await seedStaff(db, { staffNo, name: `Staff ${staffNo}`, uid: `uid-staff-${staffNo}` });
  return { id, staffNo };
}

async function insertOrder(db: PGlite, p: { staffId: string; phone?: string | null }): Promise<string> {
  const groupNo = `G-2610-${String(nextGroupNo++).padStart(4, '0')}`;
  const r = await db.query<{ id: string }>(
    `insert into seva_orders (group_no, client_order_id, channel, counter_id, issued_by_staff_id, devotee_name,
                              phone_e164, receipts_count, amount_total, payment_mode, cash_received, change_returned,
                              issued_at)
     values ($1, gen_random_uuid(), 'counter', 1, $2::uuid, 'Venkatesh Rao', $3, 1, 105, 'cash', 200, 95,
             '2026-10-18T05:00:00Z')
     returning id`,
    [groupNo, p.staffId, p.phone ?? null],
  );
  return r.rows[0].id;
}

async function insertReceipt(
  db: PGlite,
  p: { orderId: string; staffId: string; staffNo: number; runningNo?: number; receiptNo?: string },
): Promise<string> {
  const runningNo = p.runningNo ?? nextRunningNo++;
  const receiptNo =
    p.receiptNo ?? `C1-${String(p.staffNo).padStart(3, '0')}-10-2026/${String(runningNo).padStart(6, '0')}`;
  const r = await db.query<{ id: string }>(
    `insert into seva_receipts (receipt_no, series_code, year, month, running_no, staff_no, order_id, position,
                                client_receipt_id, seva_date, business_date, total, qr_token, prasadam_state,
                                issued_at, issued_by_staff_id, issued_by_name)
     values ($1, 'C1', 2026, 10, $2::int, $3::smallint, $4::uuid, 1, gen_random_uuid(), '2026-10-20', '2026-10-18',
             105, $5, 'pending', '2026-10-18T05:00:00Z', $6::uuid, 'Ramesh')
     returning id`,
    [receiptNo, runningNo, p.staffNo, p.orderId, qrToken(), p.staffId],
  );
  return r.rows[0].id;
}

async function newReceipt(db: PGlite): Promise<{ staffId: string; orderId: string; receiptId: string }> {
  const staff = await newStaff(db);
  const orderId = await insertOrder(db, { staffId: staff.id });
  const receiptId = await insertReceipt(db, { orderId, staffId: staff.id, staffNo: staff.staffNo });
  return { staffId: staff.id, orderId, receiptId };
}

async function insertLine(
  db: PGlite,
  p: {
    receiptId: string;
    sevaId: string;
    lineNo: number;
    quantity: number;
    catalogueRate: string | null;
    unitRate: string;
    amount: string;
    changeReason?: string | null;
  },
): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into seva_receipt_lines (receipt_id, line_no, seva_id, seva_code, seva_name_en, quantity, catalogue_rate,
                                     unit_rate, amount, change_reason)
     values ($1::uuid, $2::smallint, $3::uuid, 'PAN', 'Panchamrita Abhisheka', $4::smallint, $5::numeric,
             $6::numeric, $7::numeric, $8)
     returning id`,
    [p.receiptId, p.lineNo, p.sevaId, p.quantity, p.catalogueRate, p.unitRate, p.amount, p.changeReason ?? null],
  );
  return r.rows[0].id;
}

describe('seva schema (A1-1)', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
  });

  afterAll(async () => {
    await db.close();
  });

  it('applies every seva migration twice without error', async () => {
    const files = sevaMigrationFiles();
    expect(files).toEqual(expect.arrayContaining([...A1_FILES]));
    for (const file of files) {
      await expect(applyMigrationFile(db, file)).resolves.toBeUndefined();
    }
  });

  it('enables RLS with the deny-all policy on all 20 seva tables', async () => {
    const rls = await db.query<{ relname: string; rls: boolean }>(
      `select c.relname, c.relrowsecurity as rls
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname in (${TABLE_LIST_SQL})
        order by c.relname`,
    );
    expect(rls.rows.map((r) => r.relname)).toEqual([...SEVA_TABLES].sort());
    expect(rls.rows.every((r) => r.rls)).toBe(true);

    const policies = await db.query<{
      tablename: string;
      policyname: string;
      cmd: string;
      roles: string;
      qual: string;
      with_check: string;
    }>(
      `select tablename, policyname, cmd, roles::text as roles, qual, with_check
         from pg_policies
        where schemaname = 'public' and tablename in (${TABLE_LIST_SQL})
        order by tablename`,
    );
    expect(policies.rows).toHaveLength(SEVA_TABLES.length);
    for (const p of policies.rows) {
      expect(p).toEqual({
        tablename: p.tablename,
        policyname: `Deny all public access to ${p.tablename}`,
        cmd: 'ALL',
        roles: '{public}',
        qual: 'false',
        with_check: 'false',
      });
    }
  });

  it('refuses anon and authenticated on every seva table', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      for (const table of SEVA_TABLES) {
        await expect(asRole(db, role, (d) => d.query(`select 1 from ${table} limit 1`))).rejects.toThrow(
          /permission denied/,
        );
        const priv = await db.query<{ has: boolean }>(
          `select has_table_privilege($1, $2, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') as has`,
          [role, `public.${table}`],
        );
        expect({ role, table, has: priv.rows[0].has }).toEqual({ role, table, has: false });
      }
      for (const table of IDENTITY_TABLES) {
        const seq = await db.query<{ has: boolean }>(
          `select has_sequence_privilege($1, pg_get_serial_sequence($2, 'id'), 'USAGE, SELECT, UPDATE') as has`,
          [role, `public.${table}`],
        );
        expect({ role, table, has: seq.rows[0].has }).toEqual({ role, table, has: false });
      }
    }
  });

  it('lets only service_role execute seva functions', async () => {
    const fns = await db.query<{ sig: string; secdef: boolean; config: string | null }>(
      `select p.oid::regprocedure::text as sig, p.prosecdef as secdef, p.proconfig::text as config
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'seva\\_%'
        order by 1`,
    );
    const sigs = fns.rows.map((f) => f.sig);
    expect(sigs).toEqual(
      expect.arrayContaining([
        'seva_ist_parts(timestamp with time zone)',
        'seva_receipt_no(text,smallint,text,smallint,smallint,integer)',
        'seva_audit(text,text,text,text,text,jsonb,jsonb,uuid)',
        'seva_strip_phones(jsonb)',
        'seva_next_staff_no()',
        'seva_forbid_change()',
        'seva_staff_guard()',
        'seva_sevas_rate_history()',
        'seva_receipts_guard()',
      ]),
    );
    for (const f of fns.rows) {
      expect({ sig: f.sig, secdef: f.secdef }).toEqual({ sig: f.sig, secdef: false });
      expect({ sig: f.sig, config: f.config }).toEqual({ sig: f.sig, config: expect.stringContaining('search_path=public, pg_temp') });
      const priv = await db.query<{ anon: boolean; auth: boolean; service: boolean }>(
        `select has_function_privilege('anon', $1, 'EXECUTE') as anon,
                has_function_privilege('authenticated', $1, 'EXECUTE') as auth,
                has_function_privilege('service_role', $1, 'EXECUTE') as service`,
        [f.sig],
      );
      expect({ sig: f.sig, ...priv.rows[0] }).toEqual({ sig: f.sig, anon: false, auth: false, service: true });
    }
    await expect(asRole(db, 'anon', (d) => d.query('select seva_next_staff_no()'))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      asRole(db, 'service_role', (d) => d.query(`select * from seva_ist_parts(now())`)),
    ).resolves.toBeDefined();
  });

  it('keeps audit_log append-only even for service_role', async () => {
    const id = await asRole(db, 'service_role', async (d) => {
      const r = await d.query<{ id: number }>(
        `select seva_audit('seva.update', 'sevas', 'probe', null, 'append-only probe', null, null, null)::int as id`,
      );
      return r.rows[0].id;
    });
    expect(id).toBeGreaterThan(0);
    await expect(
      asRole(db, 'service_role', (d) => d.query(`insert into audit_log (action, entity) values ('seva.update', 'sevas')`)),
    ).resolves.toBeDefined();

    for (const sql of [`update audit_log set reason = 'rewritten'`, 'delete from audit_log', 'truncate audit_log']) {
      await expect(asRole(db, 'service_role', (d) => d.query(sql))).rejects.toThrow(/permission denied/);
      await expect(db.query(sql)).rejects.toThrow(/seva guard: (UPDATE|DELETE|TRUNCATE) on audit_log is not allowed/);
    }
    const left = await db.query<{ n: number }>(`select count(*)::int as n from audit_log`);
    expect(left.rows[0].n).toBeGreaterThanOrEqual(2);
  });

  it('seva_audit records the actor and keeps phone numbers out', async () => {
    const staff = await newStaff(db);
    const r = await asRole(db, 'service_role', (d) =>
      d.query<{ id: number }>(
        `select seva_audit('receipt.cancel', 'seva_receipts', 'r-1', 'C1-100-10-2026/000001', 'Wrong seva entered',
                           '{"status":"issued","phone_e164":"+919845012345","phone":"98450 12345"}'::jsonb,
                           '{"status":"cancelled"}'::jsonb, $1::uuid)::int as id`,
        [staff.id],
      ),
    );
    const row = await db.query<{ actor_staff_id: string; actor_uid: string; before: string; after: string }>(
      `select actor_staff_id, actor_uid, before::text as before, after::text as after from audit_log where id = $1`,
      [r.rows[0].id],
    );
    expect(row.rows[0]).toEqual({
      actor_staff_id: staff.id,
      actor_uid: `uid-staff-${staff.staffNo}`,
      before: '{"status": "issued"}',
      after: '{"status": "cancelled"}',
    });
    await expect(db.query(`select seva_audit('Not An Action', 'x', null, null, null, null, null, null)`)).rejects.toThrow(
      /SEVA:validation/,
    );
  });

  it('seva_audit strips phone keys at every depth of objects and arrays', async () => {
    const nestedBefore = {
      status: 'issued',
      phone: '+919845012345',
      devotee: {
        name: 'Venkatesh Rao',
        phone_e164: '+919845012345',
        contact: { phoneE164: '+919845012345', city: 'Mysuru' },
      },
    };
    const nestedAfter = {
      receipts: [
        { receipt_no: 'C1-100-10-2026/000001', devotee: { name: 'A', phone: '98450 12345' } },
        { receipt_no: 'C1-100-10-2026/000002', phone_e164: '+919845012345', lines: [[{ phoneE164: '+919845012345', qty: 1 }]] },
      ],
      note: 'phone is a word in a value, not a key',
    };
    const r = await asRole(db, 'service_role', (d) =>
      d.query<{ id: number }>(
        `select seva_audit('receipt.superseded', 'seva_orders', 'o-1', null, 'Nested phone probe',
                           $1::jsonb, $2::jsonb, null)::int as id`,
        [JSON.stringify(nestedBefore), JSON.stringify(nestedAfter)],
      ),
    );
    const row = await db.query<{ before: unknown; after: unknown; leaks: number }>(
      `select before, after,
              (select count(*)::int
                 from (values (before), (after)) v(j),
                      unnest(array['phone', 'phone_e164', 'phoneE164']) k(key)
                where v.j is not null
                  and jsonb_path_exists(v.j, ('strict $.**.' || k.key)::jsonpath)) as leaks
         from audit_log where id = $1`,
      [r.rows[0].id],
    );
    expect(row.rows[0].leaks).toBe(0);
    expect(row.rows[0].before).toEqual({
      status: 'issued',
      devotee: { name: 'Venkatesh Rao', contact: { city: 'Mysuru' } },
    });
    expect(row.rows[0].after).toEqual({
      receipts: [
        { receipt_no: 'C1-100-10-2026/000001', devotee: { name: 'A' } },
        { receipt_no: 'C1-100-10-2026/000002', lines: [[{ qty: 1 }]] },
      ],
      note: 'phone is a word in a value, not a key',
    });

    const arrays = await asRole(db, 'service_role', (d) =>
      d.query<{ id: number }>(
        `select seva_audit('receipt.reissue_spoiled', 'seva_receipts', 'r-2', null, 'Array probe',
                           '[{"devotee":{"phone_e164":"+919845012345","name":"B"}},{"phone":"98450 12345"},"x",1,null]'::jsonb,
                           '"plain"'::jsonb, null)::int as id`,
      ),
    );
    const arrRow = await db.query<{ before: string; after: string }>(
      `select before::text as before, after::text as after from audit_log where id = $1`,
      [arrays.rows[0].id],
    );
    expect(arrRow.rows[0]).toEqual({
      before: '[{"devotee": {"name": "B"}}, {}, "x", 1, null]',
      after: '"plain"',
    });
  });

  it('lets only service_role execute seva_strip_phones', async () => {
    const priv = await db.query<{ anon: boolean; auth: boolean; pub: boolean; service: boolean }>(
      `select has_function_privilege('anon', 'seva_strip_phones(jsonb)', 'EXECUTE') as anon,
              has_function_privilege('authenticated', 'seva_strip_phones(jsonb)', 'EXECUTE') as auth,
              exists (select 1
                        from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                       where p.oid = 'seva_strip_phones(jsonb)'::regprocedure and a.grantee = 0) as pub,
              has_function_privilege('service_role', 'seva_strip_phones(jsonb)', 'EXECUTE') as service`,
    );
    expect(priv.rows[0]).toEqual({ anon: false, auth: false, pub: false, service: true });
    await expect(
      asRole(db, 'anon', (d) => d.query(`select seva_strip_phones('{"phone":"1"}'::jsonb)`)),
    ).rejects.toThrow(/permission denied/);
  });

  it('never re-points a staff login and keeps deleted final', async () => {
    const id = await seedStaff(db, { staffNo: 31, name: 'Shanthamma', uid: 'uid-shanthamma' });
    const asOwner = (sql: string, params: unknown[]) => db.query(sql, params);
    const asService = (sql: string, params: unknown[]) => asRole(db, 'service_role', (d) => d.query(sql, params));
    for (const run of [asOwner, asService]) {
      await expect(run(`update staff set firebase_uid = 'uid-someone-else' where id = $1`, [id])).rejects.toThrow(
        /seva guard: a staff login \(firebase_uid\) never changes/,
      );
    }
    await db.query(`update staff set status = 'deleted', status_reason = 'Left the temple office' where id = $1`, [id]);
    for (const status of ['active', 'inactive', 'invited']) {
      await expect(
        asService(`update staff set status = $2, status_reason = 'Came back' where id = $1`, [id, status]),
      ).rejects.toThrow(/seva guard: a deleted staff member stays deleted/);
    }
    await db.query(`update staff set status_reason = 'Left the temple office in October' where id = $1`, [id]);
    const kept = await db.query<{ firebase_uid: string; status: string }>(
      'select firebase_uid, status from staff where id = $1',
      [id],
    );
    expect(kept.rows[0]).toEqual({ firebase_uid: 'uid-shanthamma', status: 'deleted' });
  });

  it('never deletes or truncates day closes', async () => {
    const staff = await newStaff(db);
    const close = await db.query<{ id: string }>(
      `insert into day_closes (counter_id, business_date, cash_expected, cash_counted, series_ranges, outbox_pending,
                               closed_by_staff_id, closed_at)
       values (1, '2026-10-05', 500, 500, '{}'::jsonb, 0, $1::uuid, now())
       returning id`,
      [staff.id],
    );
    const id = close.rows[0].id;
    await db.query(
      `insert into day_close_counts (day_close_id, kind, value, count) values ($1::uuid, 'note', 500, 1)`,
      [id],
    );
    await expect(db.query('delete from day_closes where id = $1', [id])).rejects.toThrow(
      /seva guard: DELETE on day_closes is not allowed/,
    );
    await expect(
      asRole(db, 'service_role', (d) => d.query('delete from day_closes where id = $1', [id])),
    ).rejects.toThrow(/seva guard: DELETE on day_closes is not allowed/);
    await expect(db.query('truncate day_closes cascade')).rejects.toThrow(
      /seva guard: TRUNCATE on day_closes is not allowed/,
    );
    const left = await db.query<{ closes: number; counts: number }>(
      `select (select count(*)::int from day_closes where id = $1) as closes,
              (select count(*)::int from day_close_counts where day_close_id = $1) as counts`,
      [id],
    );
    expect(left.rows[0]).toEqual({ closes: 1, counts: 1 });
  });

  it('never deletes staff and keeps staff_no unique in 1..999', async () => {
    const id = await seedStaff(db, { staffNo: 7, name: 'Lakshmi', uid: 'uid-lakshmi' });
    await expect(db.query('delete from staff where id = $1', [id])).rejects.toThrow(/staff rows are never deleted/);
    await expect(asRole(db, 'service_role', (d) => d.query('delete from staff where id = $1', [id]))).rejects.toThrow(
      /staff rows are never deleted/,
    );
    await expect(db.query('truncate staff')).rejects.toThrow(/seva guard|foreign key/);
    await expect(seedStaff(db, { staffNo: 7, name: 'Someone else', uid: 'uid-other-7' })).rejects.toThrow(
      /duplicate key value violates unique constraint "staff_staff_no_key"/,
    );
    await expect(seedStaff(db, { staffNo: 1000, name: 'Too high', uid: 'uid-1000' })).rejects.toThrow(
      /violates check constraint/,
    );
    await expect(seedStaff(db, { staffNo: 0, name: 'Too low', uid: 'uid-0' })).rejects.toThrow(
      /violates check constraint/,
    );
    await expect(db.query('update staff set staff_no = 8 where id = $1', [id])).rejects.toThrow(
      /staff number never changes/,
    );
    await expect(db.query(`update staff set status = 'inactive' where id = $1`, [id])).rejects.toThrow(
      /staff_status_reason_required/,
    );
    await db.query(`update staff set status = 'inactive', status_reason = 'Left the temple office' where id = $1`, [id]);
    await expect(
      db.query(`insert into staff (firebase_uid, staff_no, full_name, email) values ('uid-upper', 9, 'Upper', 'Upper@Example.test')`),
    ).rejects.toThrow(/violates check constraint/);
    const kept = await db.query<{ staff_no: number; status: string }>(
      'select staff_no, status from staff where id = $1',
      [id],
    );
    expect(kept.rows[0]).toEqual({ staff_no: 7, status: 'inactive' });
  });

  it('guards issued receipts', async () => {
    const { staffId, orderId, receiptId } = await newReceipt(db);
    for (const set of [
      'total = 110',
      `receipt_no = 'C1-999-10-2026/000999'`,
      `seva_date = '2026-10-21'`,
      `qr_token = '${qrToken()}'`,
      'running_no = 999',
      `business_date = '2026-10-19'`,
      'issued_at = now()',
      'client_receipt_id = gen_random_uuid()',
      'has_changed_amount = true',
      'issued_offline = true',
      'test_mode = true',
    ]) {
      await expect(db.query(`update seva_receipts set ${set} where id = $1`, [receiptId])).rejects.toThrow(
        /seva guard: seva_receipts\.\w+ never changes after issue/,
      );
    }

    await db.query(
      `update seva_receipts
          set print_count = 1, first_printed_at = now(), last_printed_at = now(),
              prasadam_state = 'given', prasadam_given_at = now(), prasadam_given_by_staff_id = $2::uuid
        where id = $1`,
      [receiptId, staffId],
    );
    await expect(db.query(`update seva_receipts set status = 'cancelled' where id = $1`, [receiptId])).rejects.toThrow(
      /seva_receipts_cancel_fields/,
    );
    await expect(
      db.query(
        `update seva_receipts set status = 'cancelled', cancel_reason_code = 'other', cancelled_at = now(),
                cancelled_by_staff_id = $2::uuid where id = $1`,
        [receiptId, staffId],
      ),
    ).rejects.toThrow(/seva_receipts_other_needs_note/);
    await expect(
      db.query(
        `update seva_receipts set status = 'cancelled', cancel_reason_code = 'bogus', cancelled_at = now(),
                cancelled_by_staff_id = $2::uuid where id = $1`,
        [receiptId, staffId],
      ),
    ).rejects.toThrow(/violates check constraint/);
    await db.query(
      `update seva_receipts set status = 'cancelled', cancel_reason_code = 'wrong_seva', cancelled_at = now(),
              cancelled_by_staff_id = $2::uuid, refund_state = 'done', refund_note = 'Given back from the drawer'
        where id = $1`,
      [receiptId, staffId],
    );
    await expect(
      db.query(
        `update seva_receipts set status = 'issued', cancel_reason_code = null, cancelled_at = null,
                cancelled_by_staff_id = null where id = $1`,
        [receiptId],
      ),
    ).rejects.toThrow(/a cancelled receipt stays cancelled/);
    await expect(
      db.query(`update seva_receipts set cancel_reason_code = 'wrong_date' where id = $1`, [receiptId]),
    ).rejects.toThrow(/seva_receipts\.cancel_reason_code is fixed once the receipt is cancelled/);

    await expect(db.query('delete from seva_receipts where id = $1', [receiptId])).rejects.toThrow(
      /receipts are never deleted/,
    );
    await expect(
      asRole(db, 'service_role', (d) => d.query('delete from seva_receipts where id = $1', [receiptId])),
    ).rejects.toThrow(/receipts are never deleted/);

    const staff = await newStaff(db);
    await expect(
      insertReceipt(db, { orderId, staffId: staff.id, staffNo: staff.staffNo, runningNo: 500, receiptNo: 'C1-001-10-2026/000500' }),
    ).rejects.toThrow(/seva_receipts_number_matches_parts/);
    await expect(
      insertReceipt(db, { orderId, staffId: staff.id, staffNo: staff.staffNo, runningNo: 501, receiptNo: 'C1-100-10-2026/501' }),
    ).rejects.toThrow(/violates check constraint/);

    const row = await db.query<{ status: string; print_count: number; refund_state: string }>(
      'select status, print_count, refund_state from seva_receipts where id = $1',
      [receiptId],
    );
    expect(row.rows[0]).toEqual({ status: 'cancelled', print_count: 1, refund_state: 'done' });
  });

  it('keeps orders and lines immutable', async () => {
    const { orderId, receiptId } = await newReceipt(db);
    const sevaId = await seedSeva(db, { code: 'IMM', nameEn: 'Immutable probe', amount: '105.00' });
    const lineId = await insertLine(db, {
      receiptId,
      sevaId,
      lineNo: 1,
      quantity: 1,
      catalogueRate: '105.00',
      unitRate: '105.00',
      amount: '105.00',
    });

    await expect(db.query(`update seva_orders set devotee_name = 'Changed' where id = $1`, [orderId])).rejects.toThrow(
      /seva guard: UPDATE on seva_orders is not allowed/,
    );
    await expect(db.query('delete from seva_orders where id = $1', [orderId])).rejects.toThrow(
      /seva guard: DELETE on seva_orders is not allowed/,
    );
    await expect(db.query('update seva_receipt_lines set quantity = 2, amount = 210 where id = $1', [lineId])).rejects.toThrow(
      /seva guard: UPDATE on seva_receipt_lines is not allowed/,
    );
    await expect(db.query('delete from seva_receipt_lines where id = $1', [lineId])).rejects.toThrow(
      /seva guard: DELETE on seva_receipt_lines is not allowed/,
    );
    await expect(db.query('truncate seva_receipt_lines')).rejects.toThrow(
      /seva guard: TRUNCATE on seva_receipt_lines is not allowed/,
    );
    for (const sql of [
      `update seva_orders set devotee_name = 'Changed' where id = '${orderId}'`,
      `delete from seva_receipt_lines where id = '${lineId}'`,
    ]) {
      await expect(asRole(db, 'service_role', (d) => d.query(sql))).rejects.toThrow(/seva guard/);
    }
  });

  it('checks line maths and changed-amount reasons', async () => {
    const { receiptId } = await newReceipt(db);
    const sevaId = await seedSeva(db, { code: 'PAN', nameEn: 'Panchamrita Abhisheka', amount: '105.00' });
    const base = { receiptId, sevaId, catalogueRate: '105.00' };

    await expect(insertLine(db, { ...base, lineNo: 1, quantity: 2, unitRate: '105.00', amount: '200.00' })).rejects.toThrow(
      /seva_receipt_lines_amount/,
    );
    await expect(insertLine(db, { ...base, lineNo: 1, quantity: 1, unitRate: '150.00', amount: '150.00' })).rejects.toThrow(
      /seva_receipt_lines_change_reason/,
    );
    await expect(
      insertLine(db, { ...base, lineNo: 1, quantity: 1, unitRate: '150.00', amount: '150.00', changeReason: '   ' }),
    ).rejects.toThrow(/seva_receipt_lines_change_reason/);
    await expect(insertLine(db, { ...base, lineNo: 1, quantity: 1, unitRate: '0', amount: '0' })).rejects.toThrow(
      /violates check constraint/,
    );
    await expect(insertLine(db, { ...base, lineNo: 1, quantity: 100, unitRate: '105.00', amount: '10500.00' })).rejects.toThrow(
      /violates check constraint/,
    );
    await expect(insertLine(db, { ...base, lineNo: 9, quantity: 1, unitRate: '105.00', amount: '105.00' })).rejects.toThrow(
      /violates check constraint/,
    );

    const changedId = await insertLine(db, {
      ...base,
      lineNo: 1,
      quantity: 1,
      unitRate: '150.00',
      amount: '150.00',
      changeReason: 'Devotee offered more',
    });
    const sameId = await insertLine(db, { ...base, lineNo: 2, quantity: 3, unitRate: '105.00', amount: '315.00' });
    const anyId = await insertLine(db, {
      ...base,
      catalogueRate: null,
      lineNo: 3,
      quantity: 1,
      unitRate: '501.00',
      amount: '501.00',
    });
    await expect(insertLine(db, { ...base, lineNo: 3, quantity: 1, unitRate: '105.00', amount: '105.00' })).rejects.toThrow(
      /seva_receipt_lines_receipt_line_key/,
    );

    const rows = await db.query<{ id: string; amount_changed: boolean }>(
      'select id, amount_changed from seva_receipt_lines where receipt_id = $1 order by line_no',
      [receiptId],
    );
    expect(rows.rows).toEqual([
      { id: changedId, amount_changed: true },
      { id: sameId, amount_changed: false },
      { id: anyId, amount_changed: false },
    ]);
  });

  it('writes rate history with the session reason or a default', async () => {
    const staff = await newStaff(db);
    const sevaId = await seedSeva(db, { code: 'RTH', nameEn: 'Rate probe', amount: '105.00' });

    await db.transaction(async (tx) => {
      await tx.query(`select set_config('seva.change_reason', 'Office revision', true)`);
      await tx.query(`select set_config('seva.change_staff_id', $1, true)`, [staff.id]);
      await tx.query('update sevas set amount = 120 where id = $1', [sevaId]);
    });
    await db.query('update sevas set amount = 130 where id = $1', [sevaId]);
    await db.query(`update sevas set name = 'Rate probe renamed' where id = $1`, [sevaId]);
    await db.query('update sevas set amount = 130 where id = $1', [sevaId]);

    const rows = await db.query<{ old_amount: string; new_amount: string; reason: string; by: string | null }>(
      `select old_amount::text as old_amount, new_amount::text as new_amount, reason, changed_by_staff_id as by
         from seva_rate_history where seva_id = $1 order by id`,
      [sevaId],
    );
    expect(rows.rows).toEqual([
      { old_amount: '105.00', new_amount: '120.00', reason: 'Office revision', by: staff.id },
      { old_amount: '120.00', new_amount: '130.00', reason: 'changed outside the app', by: null },
    ]);

    await expect(db.query(`update seva_rate_history set reason = 'x' where seva_id = $1`, [sevaId])).rejects.toThrow(
      /seva guard: UPDATE on seva_rate_history is not allowed/,
    );
    await expect(db.query('delete from seva_rate_history where seva_id = $1', [sevaId])).rejects.toThrow(
      /seva guard: DELETE on seva_rate_history is not allowed/,
    );
  });

  it('gives existing and new sevas visibility both', async () => {
    const base = await PGlite.create({ extensions: { uuid_ossp, pgcrypto } });
    try {
      await base.exec(`
        create extension if not exists "uuid-ossp";
        create extension if not exists pgcrypto;
        create role anon nologin noinherit;
        create role authenticated nologin noinherit;
        create role service_role nologin noinherit bypassrls;
      `);
      await applyMigrationFile(base, '20260907112632_create_core_tables.sql');
      await applyMigrationFile(base, '20260908120000_create_sevas_table.sql');
      await base.query(
        `insert into sevas (name, description, category, amount, duration) values ('Existing seva', '', 'Seva', 50, 30)`,
      );
      for (const file of sevaMigrationFiles()) {
        await applyMigrationFile(base, file);
      }

      const existing = await base.query<Record<string, unknown>>(
        `select visibility, multi_date, allow_amount_change, any_amount, prasadam_given, code, name_kn, duration
           from sevas where name = 'Existing seva'`,
      );
      expect(existing.rows[0]).toEqual({
        visibility: 'both',
        multi_date: false,
        allow_amount_change: true,
        any_amount: false,
        prasadam_given: true,
        code: null,
        name_kn: null,
        duration: 30,
      });

      await base.query(`insert into sevas (name, description, category, amount) values ('New seva', '', 'Seva', 75)`);
      const fresh = await base.query<{ visibility: string; duration: number }>(
        `select visibility, duration from sevas where name = 'New seva'`,
      );
      expect(fresh.rows[0]).toEqual({ visibility: 'both', duration: 0 });

      await expect(
        base.query(`insert into sevas (name, description, category, amount, any_amount) values ('Karnike', '', 'Seva', 0, true)`),
      ).rejects.toThrow(/sevas_any_amount_counter_only/);
      await base.query(
        `insert into sevas (name, description, category, amount, any_amount, visibility, code)
         values ('Karnike', '', 'Seva', 0, true, 'counter', 'KAR')`,
      );
      await expect(
        base.query(`insert into sevas (name, description, category, amount, code) values ('Lower', '', 'Seva', 1, 'kar')`),
      ).rejects.toThrow(/sevas_code_format/);
      await expect(
        base.query(`insert into sevas (name, description, category, amount, code) values ('Twin', '', 'Seva', 1, 'KAR')`),
      ).rejects.toThrow(/sevas_code_key/);
      await expect(
        base.query(`insert into sevas (name, description, category, amount, visibility) values ('Odd', '', 'Seva', 1, 'kiosk')`),
      ).rejects.toThrow(/sevas_visibility_check/);
    } finally {
      await base.close();
    }
  });

  it('seeds series, Counter 1, 11 denominations and one settings row, idempotently', async () => {
    const check = async (): Promise<void> => {
      const series = await db.query<{ code: string; kind: string; counter_id: number | null }>(
        `select code, kind, counter_id from receipt_series where code in ('C1', 'OF1', 'W', 'WT') order by code`,
      );
      expect(series.rows).toEqual([
        { code: 'C1', kind: 'counter_online', counter_id: 1 },
        { code: 'OF1', kind: 'counter_offline', counter_id: 1 },
        { code: 'W', kind: 'online', counter_id: null },
        { code: 'WT', kind: 'online_test', counter_id: null },
      ]);

      const counter = await db.query<{ name: string; place: string; opening_float: string; active: boolean }>(
        `select name, place, opening_float::text as opening_float, active from counters where id = 1`,
      );
      expect(counter.rows).toEqual([{ name: 'Counter 1', place: 'Office PC', opening_float: '0.00', active: true }]);

      const denoms = await db.query<{ kind: string; value: string; shown: boolean }>(
        `select kind, value::text as value, shown from cash_denominations order by display_order`,
      );
      expect(denoms.rows.map((d) => `${d.kind} ${d.value}`)).toEqual([
        'note 500.00',
        'note 200.00',
        'note 100.00',
        'note 50.00',
        'note 20.00',
        'note 10.00',
        'coin 20.00',
        'coin 10.00',
        'coin 5.00',
        'coin 2.00',
        'coin 1.00',
      ]);
      expect(denoms.rows.every((d) => d.shown)).toBe(true);

      const settings = await db.query<Record<string, unknown>>(
        `select id, temple_name_en, temple_name_kn, address_line1, address_line2, registration_line, footer_line1,
                footer_line2, footer_blessing, photo_left_url, photo_right_url, print_gotra, print_nakshatra,
                print_rashi, cancel_window_minutes, cash_difference_note_required, amount_change_reason_required,
                counter_days_ahead, online_days_ahead, online_same_day_cutoff::text as cutoff, prasadam_undo_seconds,
                day_close_flag_threshold::text as threshold, tally_cash_ledger, tally_upi_ledger, tally_online_ledger,
                tally_columns
           from seva_settings`,
      );
      expect(settings.rows).toHaveLength(1);
      const s = settings.rows[0];
      for (const col of [
        'temple_name_en',
        'temple_name_kn',
        'address_line1',
        'address_line2',
        'registration_line',
        'footer_line1',
        'footer_line2',
        'footer_blessing',
      ]) {
        expect({ col, value: s[col] }).toEqual({ col, value: expect.stringMatching(/^SAMPLE - \S/) });
      }
      expect(s).toMatchObject({
        id: 1,
        photo_left_url: null,
        photo_right_url: null,
        print_gotra: true,
        print_nakshatra: true,
        print_rashi: false,
        cancel_window_minutes: 30,
        cash_difference_note_required: true,
        amount_change_reason_required: true,
        counter_days_ahead: 365,
        online_days_ahead: 90,
        cutoff: '12:00:00',
        prasadam_undo_seconds: 120,
        threshold: '0.00',
        tally_cash_ledger: 'Cash',
        tally_upi_ledger: 'Bank - UPI',
        tally_online_ledger: 'Gateway clearing',
        tally_columns: null,
      });
    };

    await check();
    await applyMigrationFile(db, SEED_FILE);
    await applyMigrationFile(db, SEED_FILE);
    await check();

    await expect(db.query(`insert into seva_settings (id, temple_name_en, temple_name_kn, address_line1, address_line2,
        footer_line1, footer_line2, footer_blessing) values (2, 'a', 'b', 'c', 'd', 'e', 'f', 'g')`)).rejects.toThrow(
      /violates check constraint/,
    );

    const seedSql = readSeedSql();
    expect(seedSql).not.toMatch(/[0-9]{10}/);
    expect(seedSql).not.toMatch(/\+91/);
  });

  it('formats the four receipt series', async () => {
    const r = await db.query<{ c: string; of: string; w: string; wt: string }>(
      `select seva_receipt_no('C1', 23::smallint, null, 10::smallint, 2026::smallint, 124) as c,
              seva_receipt_no('OF1', 23::smallint, null, 10::smallint, 2026::smallint, 7) as of,
              seva_receipt_no('W', null, 'WEB', 10::smallint, 2026::smallint, 45) as w,
              seva_receipt_no('WT', null, 'APP', 1::smallint, 2027::smallint, 1) as wt`,
    );
    expect(r.rows[0]).toEqual({
      c: 'C1-023-10-2026/000124',
      of: 'OF1-023-10-2026/000007',
      w: 'W-WEB-10-2026/000045',
      wt: 'WT-APP-01-2027/000001',
    });

    for (const args of [
      `'C1', null, null, 10::smallint, 2026::smallint, 1`,
      `'C1', 1000::smallint, null, 10::smallint, 2026::smallint, 1`,
      `'W', null, 'XYZ', 10::smallint, 2026::smallint, 1`,
      `'W', null, null, 10::smallint, 2026::smallint, 1`,
      `'Q1', 1::smallint, null, 10::smallint, 2026::smallint, 1`,
      `'C1', 1::smallint, null, 13::smallint, 2026::smallint, 1`,
      `'C1', 1::smallint, null, 10::smallint, 2026::smallint, 0`,
      `'C1', 1::smallint, null, 10::smallint, 2026::smallint, 1000000`,
    ]) {
      await expect(db.query(`select seva_receipt_no(${args})`)).rejects.toThrow(/SEVA:validation/);
    }
  });

  it('seva_ist_parts converts at the IST day boundary', async () => {
    const parts = async (at: string): Promise<{ year: number; month: number; business_date: string }> => {
      const r = await db.query<{ year: number; month: number; business_date: string }>(
        `select year, month, business_date::text as business_date from seva_ist_parts($1::timestamptz)`,
        [at],
      );
      return r.rows[0];
    };
    expect(await parts('2026-12-31 18:29:59+00')).toEqual({ year: 2026, month: 12, business_date: '2026-12-31' });
    expect(await parts('2026-12-31 18:30:00+00')).toEqual({ year: 2027, month: 1, business_date: '2027-01-01' });
    expect(await parts('2026-10-18 18:29:59+00')).toEqual({ year: 2026, month: 10, business_date: '2026-10-18' });

    await db.exec(`set timezone = 'America/New_York'`);
    try {
      expect(await parts('2026-12-31 18:30:00+00')).toEqual({ year: 2027, month: 1, business_date: '2027-01-01' });
    } finally {
      await db.exec('reset timezone');
    }
  });

  it('accepts only Indian mobiles in phone_e164', async () => {
    const staff = await newStaff(db);
    await expect(insertOrder(db, { staffId: staff.id, phone: '+919845012345' })).resolves.toEqual(expect.any(String));
    for (const phone of ['+915123456789', '9845012345', '+91 9845012345', '+9198450123456']) {
      await expect(insertOrder(db, { staffId: staff.id, phone })).rejects.toThrow(/violates check constraint/);
    }
    await db.query(`insert into devotee_profiles (phone_e164, name) values ('+919845012345', 'Venkatesh Rao')`);
    await expect(
      db.query(`insert into devotee_profiles (phone_e164, name) values ('98450 12345', 'Venkatesh Rao')`),
    ).rejects.toThrow(/violates check constraint/);
  });

  it('checks series codes', async () => {
    await expect(
      db.query(`insert into receipt_series (code, kind, counter_id) values ('C100', 'counter_online', 1)`),
    ).rejects.toThrow(/violates check constraint/);
    await db.query(`insert into counters (id, name, place) values (12, 'Counter 12', 'Hall')`);
    await db.query(`insert into receipt_series (code, kind, counter_id) values ('OF12', 'counter_offline', 12)`);
    await expect(
      db.query(`insert into receipt_series (code, kind, counter_id) values ('C12', 'counter_online', null)`),
    ).rejects.toThrow(/receipt_series_counter_matches_kind/);
    await expect(
      db.query(`insert into receipt_series (code, kind, counter_id) values ('C13', 'counter_online', 12)`),
    ).rejects.toThrow(/receipt_series_code_matches_kind/);
    await expect(
      db.query(`insert into receipt_series (code, kind, counter_id) values ('C1', 'online', null)`),
    ).rejects.toThrow(/receipt_series_code_matches_kind/);

    const staff = await newStaff(db);
    const first = await seedDevice(db, { staffId: staff.id });
    await expect(seedDevice(db, { staffId: staff.id })).rejects.toThrow(/counter_devices_one_live_per_counter/);
    await expect(seedDevice(db, { staffId: staff.id, counterId: 12, secretHash: 'not-a-hash' })).rejects.toThrow(
      /violates check constraint/,
    );
    await expect(
      db.query(`update counter_devices set retired_at = now(), retired_by_staff_id = $2::uuid where id = $1`, [
        first,
        staff.id,
      ]),
    ).rejects.toThrow(/counter_devices_retired_reason_required/);
    await db.query(
      `update counter_devices set retired_at = now(), retired_by_staff_id = $2::uuid,
              retired_reason = 'Replaced by the new office PC' where id = $1`,
      [first, staff.id],
    );
    await expect(seedDevice(db, { staffId: staff.id })).resolves.toEqual(expect.any(String));
  });

  it('checks day close notes, reopen reasons and gap notes', async () => {
    const staff = await newStaff(db);
    const close = (counted: string, note: string | null) =>
      db.query<{ id: string; diff: string }>(
        `insert into day_closes (counter_id, business_date, cash_expected, cash_counted, series_ranges, outbox_pending,
                                 note, closed_by_staff_id, closed_at)
         values (1, $1::date, 1110, $2::numeric, '{}'::jsonb, 0, $3, $4::uuid, now())
         returning id, cash_difference::text as diff`,
        [counted === '1110' ? '2026-10-10' : '2026-10-11', counted, note, staff.id],
      );
    await expect(close('1100', null)).rejects.toThrow(/day_closes_difference_note/);
    const withNote = await close('1100', 'Ten rupees short, checked twice');
    expect(withNote.rows[0].diff).toBe('-10.00');
    const exact = await close('1110', null);
    expect(exact.rows[0].diff).toBe('0.00');
    await expect(
      db.query(`update day_closes set status = 'reopened' where id = $1`, [exact.rows[0].id]),
    ).rejects.toThrow(/day_closes_reopen_reason/);
    await expect(
      db.query(
        `insert into day_closes (counter_id, business_date, cash_expected, cash_counted, series_ranges, outbox_pending,
                                 closed_by_staff_id, closed_at)
         values (1, '2026-10-12', 0, 0, '{}'::jsonb, 2, $1::uuid, now())`,
        [staff.id],
      ),
    ).rejects.toThrow(/day_closes_outbox_empty/);

    await db.query(`insert into receipt_series_years (series_code, year, last_no) values ('OF1', 2026, 3)`);
    const gap = await db.query<{ id: number }>(
      `insert into receipt_number_gaps (series_code, year, from_no, to_no, cause)
       values ('OF1', 2026, 4, 5, 'missing_in_sync') returning id::int as id`,
    );
    await expect(
      db.query(`update receipt_number_gaps set status = 'declared_lost' where id = $1`, [gap.rows[0].id]),
    ).rejects.toThrow(/receipt_number_gaps_note_required/);
    await db.query(
      `update receipt_number_gaps set status = 'received_late', resolution_note = 'Arrived in a later sync',
              resolved_at = now() where id = $1`,
      [gap.rows[0].id],
    );
    await expect(
      db.query(
        `insert into receipt_number_gaps (series_code, year, from_no, to_no, cause) values ('OF1', 2026, 9, 8, 'missing_in_sync')`,
      ),
    ).rejects.toThrow(/receipt_number_gaps_range/);
    await expect(
      db.query(
        `insert into receipt_number_gaps (series_code, year, from_no, to_no, cause) values ('OF1', 2031, 1, 2, 'device_replaced')`,
      ),
    ).rejects.toThrow(/foreign key/);
  });
});

describe('seva_next_staff_no', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
  });

  afterAll(async () => {
    await db.close();
  });

  it('seva_next_staff_no returns max + 1, starting at 1', async () => {
    const next = async (): Promise<number> => {
      const r = await db.query<{ n: number }>('select seva_next_staff_no() as n');
      return r.rows[0].n;
    };
    expect(await next()).toBe(1);
    await seedStaff(db, { staffNo: 23, name: 'Ramesh', uid: 'uid-ramesh' });
    expect(await next()).toBe(24);
    await seedStaff(db, { staffNo: 5, name: 'Suresh', uid: 'uid-suresh' });
    expect(await next()).toBe(24);
    await seedStaff(db, { staffNo: 999, name: 'Last', uid: 'uid-last' });
    await expect(next()).rejects.toThrow(/SEVA:validation/);
  });
});
