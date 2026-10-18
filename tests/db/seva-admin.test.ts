/**
 * Task A2-3 - catalogue, settings, counters and staff SQL functions
 * (supabase/migrations/20261021000200_seva_functions_admin.sql).
 *
 * Every function is called as service_role, the only role allowed to execute it, so a missing table grant would
 * fail here too. Seed rows are written as the owner through tests/db/fixtures.ts.
 */
import type { PGlite } from '@electric-sql/pglite';
import { asRole, freshDb } from './harness';
import { seedSeva, seedStaff } from './fixtures';

type Row = Record<string, unknown>;

async function svc<T extends Row = Row>(db: PGlite, sql: string, params: unknown[] = []): Promise<T[]> {
  return asRole(db, 'service_role', async (d) => (await d.query<T>(sql, params)).rows);
}

async function one<T extends Row = Row>(db: PGlite, sql: string, params: unknown[] = []): Promise<T> {
  const rows = (await db.query<T>(sql, params)).rows;
  expect(rows).toHaveLength(1);
  return rows[0];
}

async function upsertSeva(db: PGlite, seva: Record<string, unknown>, reason: string | null, staffId: string): Promise<string> {
  const rows = await svc<{ id: string }>(db, `select seva_upsert_seva($1::jsonb, $2, $3::uuid) as id`, [
    JSON.stringify(seva),
    reason,
    staffId,
  ]);
  return rows[0].id;
}

async function auditRows(db: PGlite, action: string, entityId?: string): Promise<Row[]> {
  return (
    await db.query<Row>(
      `select action, entity, entity_id, reason, before, after, actor_staff_id
         from audit_log where action = $1 and ($2::text is null or entity_id = $2) order by id`,
      [action, entityId ?? null],
    )
  ).rows;
}

describe('seva admin functions (A2-3)', () => {
  let db: PGlite;
  let admin: string;

  beforeAll(async () => {
    db = await freshDb();
    admin = await seedStaff(db, { staffNo: 8, name: 'Prakash', uid: 'uid-prakash' });
  });

  afterAll(async () => {
    await db.close();
  });

  describe('catalogue', () => {
    it('creates a seva and audits seva.create', async () => {
      const id = await upsertSeva(
        db,
        {
          code: 'pan',
          name_en: '  Panchamrita Abhisheka ',
          name_kn: 'ಪಂಚಾಮೃತ ಅಭಿಷೇಕ',
          amount: '105.00',
          category: 'Abhisheka',
          multi_date: true,
          prasadam_items: 'Panchamrita',
        },
        null,
        admin,
      );
      const seva = await one(
        db,
        `select code, name, name_kn, amount::text as amount, category, visibility, multi_date, allow_amount_change,
                any_amount, prasadam_given, prasadam_items, active, display_order, duration, updated_by_staff_id
           from sevas where id = $1`,
        [id],
      );
      expect(seva).toEqual({
        code: 'PAN',
        name: 'Panchamrita Abhisheka',
        name_kn: 'ಪಂಚಾಮೃತ ಅಭಿಷೇಕ',
        amount: '105.00',
        category: 'Abhisheka',
        visibility: 'both',
        multi_date: true,
        allow_amount_change: true,
        any_amount: false,
        prasadam_given: true,
        prasadam_items: 'Panchamrita',
        active: true,
        display_order: 1,
        duration: 0,
        updated_by_staff_id: admin,
      });
      const audit = await auditRows(db, 'seva.create', id);
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ entity: 'sevas', actor_staff_id: admin, before: null });
      expect(audit[0].after).toMatchObject({ code: 'PAN', name: 'Panchamrita Abhisheka', amount: '105.00' });
      const history = await db.query(
        `select old_amount, new_amount::text as new_amount, changed_by_staff_id from seva_rate_history where seva_id = $1`,
        [id],
      );
      expect(history.rows).toEqual([{ old_amount: null, new_amount: '105.00', changed_by_staff_id: admin }]);
    });

    it('refuses a duplicate code', async () => {
      await upsertSeva(db, { code: 'DUP', name_en: 'First', amount: '50.00' }, null, admin);
      await expect(upsertSeva(db, { code: 'dup', name_en: 'Second', amount: '60.00' }, null, admin)).rejects.toThrow(
        /SEVA:validation/,
      );
      const n = await one<{ n: number }>(db, `select count(*)::int as n from sevas where code = 'DUP'`);
      expect(n.n).toBe(1);
    });

    it('refuses bad input and an actor who is not active staff', async () => {
      await expect(upsertSeva(db, { code: 'BAD1', name_en: 'X', amount: '10.00' }, null, admin)).rejects.toThrow(
        /SEVA:validation/,
      );
      await expect(upsertSeva(db, { name_en: '   ', amount: '10.00' }, null, admin)).rejects.toThrow(/SEVA:validation/);
      await expect(upsertSeva(db, { name_en: 'No rate' }, null, admin)).rejects.toThrow(/SEVA:validation/);
      await expect(upsertSeva(db, { name_en: 'Bad rate', amount: 'abc' }, null, admin)).rejects.toThrow(
        /SEVA:validation/,
      );
      await expect(upsertSeva(db, { name_en: 'Odd', amount: '10.00', colour: 'red' }, null, admin)).rejects.toThrow(
        /SEVA:validation/,
      );
      await expect(
        upsertSeva(db, { id: '00000000-0000-4000-8000-000000000000', name_en: 'Ghost' }, null, admin),
      ).rejects.toThrow(/SEVA:not_found/);
      const invited = await seedStaff(db, { staffNo: 40, name: 'Invited', uid: 'uid-invited-40', status: 'invited' });
      await expect(upsertSeva(db, { name_en: 'Nope', amount: '10.00' }, null, invited)).rejects.toThrow(
        /SEVA:staff_inactive/,
      );
    });

    it('a rate change needs a reason and writes history with that reason', async () => {
      const id = await upsertSeva(db, { code: 'RTC', name_en: 'Rate Seva', amount: '105.00' }, null, admin);
      await expect(upsertSeva(db, { id, amount: '150.00' }, null, admin)).rejects.toThrow(/SEVA:change_reason_required/);
      await expect(upsertSeva(db, { id, amount: '150.00' }, ' x ', admin)).rejects.toThrow(/SEVA:change_reason_required/);
      expect((await one<{ amount: string }>(db, `select amount::text as amount from sevas where id = $1`, [id])).amount).toBe(
        '105.00',
      );

      await upsertSeva(db, { id, amount: '150.00' }, 'Office revision', admin);
      const history = await db.query(
        `select old_amount::text as old_amount, new_amount::text as new_amount, reason, changed_by_staff_id
           from seva_rate_history where seva_id = $1 order by id`,
        [id],
      );
      expect(history.rows).toEqual([
        { old_amount: null, new_amount: '105.00', reason: 'Seva added', changed_by_staff_id: admin },
        { old_amount: '105.00', new_amount: '150.00', reason: 'Office revision', changed_by_staff_id: admin },
      ]);
      const rate = await auditRows(db, 'seva.rate_change', id);
      expect(rate).toHaveLength(1);
      expect(rate[0]).toMatchObject({
        reason: 'Office revision',
        before: { amount: '105.00' },
        after: { amount: '150.00' },
      });
      expect(await auditRows(db, 'seva.update', id)).toHaveLength(0);

      // A plain edit needs no reason, writes no rate history and audits seva.update with only what changed.
      await upsertSeva(db, { id, name_kn: 'ದರ ಸೇವೆ', active: false }, null, admin);
      const update = await auditRows(db, 'seva.update', id);
      expect(update).toHaveLength(1);
      expect(update[0].before).toEqual({ name_kn: null, active: true });
      expect(update[0].after).toEqual({ name_kn: 'ದರ ಸೇವೆ', active: false });
      const count = await one<{ n: number }>(db, `select count(*)::int as n from seva_rate_history where seva_id = $1`, [id]);
      expect(count.n).toBe(2);
    });

    it('forces Other Seva (any amount) to counter-only', async () => {
      const id = await upsertSeva(
        db,
        { code: 'KAR', name_en: 'Other Seva', any_amount: true, visibility: 'both' },
        null,
        admin,
      );
      const seva = await one(db, `select visibility, any_amount, amount::text as amount from sevas where id = $1`, [id]);
      expect(seva).toEqual({ visibility: 'counter', any_amount: true, amount: '0.00' });
      await upsertSeva(db, { id, visibility: 'online' }, null, admin);
      expect((await one<{ visibility: string }>(db, `select visibility from sevas where id = $1`, [id])).visibility).toBe(
        'counter',
      );
    });

    it('reorders sevas to 1..n', async () => {
      const a = await upsertSeva(db, { code: 'ORA', name_en: 'Order A', amount: '10.00' }, null, admin);
      const b = await upsertSeva(db, { code: 'ORB', name_en: 'Order B', amount: '10.00' }, null, admin);
      const c = await upsertSeva(db, { code: 'ORC', name_en: 'Order C', amount: '10.00' }, null, admin);
      await svc(db, `select seva_reorder_sevas($1::uuid[], $2::uuid)`, [[c, a, b], admin]);
      const listed = await db.query<{ id: string; display_order: number }>(
        `select id, display_order from sevas where id = any($1::uuid[]) order by display_order`,
        [[a, b, c]],
      );
      expect(listed.rows).toEqual([
        { id: c, display_order: 1 },
        { id: a, display_order: 2 },
        { id: b, display_order: 3 },
      ]);
      const all = await db.query<{ display_order: number }>(`select display_order from sevas order by display_order`);
      expect(all.rows.map((r) => r.display_order)).toEqual(all.rows.map((_, i) => i + 1));
      expect(await auditRows(db, 'seva.update')).toEqual(
        expect.arrayContaining([expect.objectContaining({ entity: 'sevas', entity_id: null, after: { order: [c, a, b] } })]),
      );

      await expect(svc(db, `select seva_reorder_sevas($1::uuid[], $2::uuid)`, [[a, a], admin])).rejects.toThrow(
        /SEVA:validation/,
      );
      await expect(
        svc(db, `select seva_reorder_sevas($1::uuid[], $2::uuid)`, [[a, '00000000-0000-4000-8000-000000000000'], admin]),
      ).rejects.toThrow(/SEVA:not_found/);
    });
  });

  describe('settings', () => {
    it('audits settings changes with before and after', async () => {
      await svc(db, `select seva_update_settings($1::jsonb, $2::uuid)`, [
        JSON.stringify({ cancel_window_minutes: 20, print_rashi: true, footer_line2: 'SAMPLE - Open 6 to 12' }),
        admin,
      ]);
      const s = await one(
        db,
        `select cancel_window_minutes, print_rashi, footer_line2, updated_by_staff_id from seva_settings where id = 1`,
      );
      expect(s).toEqual({
        cancel_window_minutes: 20,
        print_rashi: true,
        footer_line2: 'SAMPLE - Open 6 to 12',
        updated_by_staff_id: admin,
      });
      const audit = await auditRows(db, 'settings.update', '1');
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ entity: 'seva_settings', actor_staff_id: admin });
      expect(audit[0].before).toEqual({
        cancel_window_minutes: 30,
        print_rashi: false,
        footer_line2: 'SAMPLE - Seva timings and contact details from the temple office',
      });
      expect(audit[0].after).toEqual({ cancel_window_minutes: 20, print_rashi: true, footer_line2: 'SAMPLE - Open 6 to 12' });

      // No change -> no audit row.
      await svc(db, `select seva_update_settings($1::jsonb, $2::uuid)`, [JSON.stringify({ print_rashi: true }), admin]);
      expect(await auditRows(db, 'settings.update', '1')).toHaveLength(1);

      for (const bad of [{ id: 2 }, { colour: 'red' }, { cancel_window_minutes: 500 }, { print_gotra: 'maybe' }, { temple_name_en: null }]) {
        await expect(svc(db, `select seva_update_settings($1::jsonb, $2::uuid)`, [JSON.stringify(bad), admin])).rejects.toThrow(
          /SEVA:validation/,
        );
      }
      expect(
        (await one<{ c: number }>(db, `select cancel_window_minutes as c from seva_settings where id = 1`)).c,
      ).toBe(20);
    });

    it('replaces denominations and audits', async () => {
      const rows = [
        { kind: 'note', value: 2000 },
        { kind: 'note', value: 500 },
        { kind: 'coin', value: 10, shown: false },
      ];
      await svc(db, `select seva_save_denominations($1::jsonb, $2::uuid)`, [JSON.stringify(rows), admin]);
      const saved = await db.query(
        `select kind, value::text as value, display_order, shown from cash_denominations order by display_order`,
      );
      expect(saved.rows).toEqual([
        { kind: 'note', value: '2000.00', display_order: 1, shown: true },
        { kind: 'note', value: '500.00', display_order: 2, shown: true },
        { kind: 'coin', value: '10.00', display_order: 3, shown: false },
      ]);
      const audit = await auditRows(db, 'denominations.update');
      expect(audit).toHaveLength(1);
      expect((audit[0].before as unknown[]).length).toBe(11);
      expect(audit[0].after).toEqual([
        { kind: 'note', value: '2000.00', shown: true },
        { kind: 'note', value: '500.00', shown: true },
        { kind: 'coin', value: '10.00', shown: false },
      ]);

      for (const bad of [
        [],
        [{ kind: 'note', value: 500 }, { kind: 'note', value: 500 }],
        [{ kind: 'note', value: 0 }],
        [{ kind: 'note', value: 2500 }],
        [{ kind: 'gold', value: 5 }],
      ]) {
        await expect(svc(db, `select seva_save_denominations($1::jsonb, $2::uuid)`, [JSON.stringify(bad), admin])).rejects.toThrow(
          /SEVA:validation/,
        );
      }
      expect((await one<{ n: number }>(db, `select count(*)::int as n from cash_denominations`)).n).toBe(3);
    });

    it('saves a festival with its dates', async () => {
      const [{ id }] = await svc<{ id: string }>(db, `select seva_save_festival($1::jsonb, $2::uuid) as id`, [
        JSON.stringify({ name_en: 'Aaradhane', name_kn: 'ಆರಾಧನೆ', days: ['2026-08-22', '2026-08-20', '2026-08-21'] }),
        admin,
      ]);
      const f = await one(db, `select name_en, name_kn, active, updated_by_staff_id from festival_days where id = $1`, [id]);
      expect(f).toEqual({ name_en: 'Aaradhane', name_kn: 'ಆರಾಧನೆ', active: true, updated_by_staff_id: admin });
      const days = await db.query<{ day: string }>(
        `select day::text as day from festival_day_dates where festival_id = $1 order by day`,
        [id],
      );
      expect(days.rows.map((r) => r.day)).toEqual(['2026-08-20', '2026-08-21', '2026-08-22']);

      const [{ id: same }] = await svc<{ id: string }>(db, `select seva_save_festival($1::jsonb, $2::uuid) as id`, [
        JSON.stringify({ id, name_en: 'Aaradhane Mahotsava', active: false, days: ['2026-08-21'] }),
        admin,
      ]);
      expect(same).toBe(id);
      const after = await db.query<{ day: string }>(
        `select day::text as day from festival_day_dates where festival_id = $1`,
        [id],
      );
      expect(after.rows).toEqual([{ day: '2026-08-21' }]);
      const audit = await auditRows(db, 'festival.update', id);
      expect(audit).toHaveLength(2);
      expect(audit[1].after).toMatchObject({ name_en: 'Aaradhane Mahotsava', active: false, days: ['2026-08-21'] });

      for (const bad of [
        { name_en: ' ', days: ['2026-08-21'] },
        { name_en: 'No days', days: [] },
        { name_en: 'Bad day', days: ['2026-02-30'] },
      ]) {
        await expect(svc(db, `select seva_save_festival($1::jsonb, $2::uuid)`, [JSON.stringify(bad), admin])).rejects.toThrow(
          /SEVA:validation/,
        );
      }
      await expect(
        svc(db, `select seva_save_festival($1::jsonb, $2::uuid)`, [
          JSON.stringify({ id: '00000000-0000-4000-8000-000000000000', name_en: 'Ghost', days: ['2026-08-21'] }),
          admin,
        ]),
      ).rejects.toThrow(/SEVA:not_found/);
    });

    it('adding a counter creates C2 and OF2', async () => {
      const [{ id }] = await svc<{ id: number }>(db, `select seva_add_counter($1, $2, $3::uuid) as id`, [
        'Counter 2',
        'Main hall',
        admin,
      ]);
      expect(id).toBe(2);
      expect(await one(db, `select name, place, active, opening_float::text as f from counters where id = 2`)).toEqual({
        name: 'Counter 2',
        place: 'Main hall',
        active: true,
        f: '0.00',
      });
      const series = await db.query(
        `select code, kind, counter_id, active from receipt_series where counter_id = 2 order by code`,
      );
      expect(series.rows).toEqual([
        { code: 'C2', kind: 'counter_online', counter_id: 2, active: true },
        { code: 'OF2', kind: 'counter_offline', counter_id: 2, active: true },
      ]);
      expect(await auditRows(db, 'settings.update', '2')).toEqual([
        expect.objectContaining({ entity: 'counters', after: expect.objectContaining({ name: 'Counter 2' }) }),
      ]);

      await svc(db, `select seva_update_counter($1::smallint, $2::jsonb, $3::uuid)`, [
        2,
        JSON.stringify({ opening_float: '500.00', place: 'Office PC 2' }),
        admin,
      ]);
      expect(await one(db, `select place, opening_float::text as f from counters where id = 2`)).toEqual({
        place: 'Office PC 2',
        f: '500.00',
      });
      const updates = await auditRows(db, 'settings.update', '2');
      expect(updates).toHaveLength(2);
      expect(updates[1].before).toEqual({ place: 'Main hall', opening_float: '0.00' });
      expect(updates[1].after).toEqual({ place: 'Office PC 2', opening_float: '500.00' });

      await expect(svc(db, `select seva_add_counter($1, $2, $3::uuid)`, [' ', null, admin])).rejects.toThrow(
        /SEVA:validation/,
      );
      for (const bad of [{ opening_float: '-1' }, { name: '' }, { colour: 'red' }]) {
        await expect(
          svc(db, `select seva_update_counter($1::smallint, $2::jsonb, $3::uuid)`, [2, JSON.stringify(bad), admin]),
        ).rejects.toThrow(/SEVA:validation/);
      }
      await expect(
        svc(db, `select seva_update_counter($1::smallint, $2::jsonb, $3::uuid)`, [9, JSON.stringify({ name: 'X' }), admin]),
      ).rejects.toThrow(/SEVA:not_found/);
    });
  });

  describe('staff', () => {
    async function onboard(p: Record<string, unknown>): Promise<string> {
      const rows = await svc<{ id: string }>(db, `select seva_staff_onboard($1::jsonb, $2::uuid) as id`, [
        JSON.stringify(p),
        admin,
      ]);
      return rows[0].id;
    }

    async function update(staffId: string, patch: Record<string, unknown>, reason: string | null): Promise<void> {
      await svc(db, `select seva_staff_update($1::uuid, $2::jsonb, $3, $4::uuid)`, [
        staffId,
        JSON.stringify(patch),
        reason,
        admin,
      ]);
    }

    it('onboards an invited staff member with the next free number', async () => {
      const max = await one<{ n: number }>(db, `select max(staff_no)::int as n from staff`);
      const id = await onboard({ firebase_uid: 'uid-suresh', full_name: ' Suresh ', email: ' Suresh@Example.COM ' });
      const s = await one(
        db,
        `select staff_no, full_name, email, status, view_only, invited_by_staff_id, invited_at is not null as invited
           from staff where id = $1`,
        [id],
      );
      expect(s).toEqual({
        staff_no: max.n + 1,
        full_name: 'Suresh',
        email: 'suresh@example.com',
        status: 'invited',
        view_only: false,
        invited_by_staff_id: admin,
        invited: true,
      });
      const audit = await auditRows(db, 'staff.onboard', id);
      expect(audit).toHaveLength(1);
      expect(audit[0].after).toEqual({ staff_no: max.n + 1, full_name: 'Suresh', view_only: false, status: 'invited' });

      const kamala = await onboard({
        firebase_uid: 'uid-kamala',
        full_name: 'Kamala',
        email: 'kamala@example.com',
        staff_no: 12,
        view_only: true,
      });
      expect(await one(db, `select staff_no, view_only from staff where id = $1`, [kamala])).toEqual({
        staff_no: 12,
        view_only: true,
      });

      for (const bad of [
        { firebase_uid: 'uid-x1', full_name: 'Dup no', email: 'x1@example.com', staff_no: 12 },
        { firebase_uid: 'uid-x2', full_name: 'Dup mail', email: 'KAMALA@example.com' },
        { firebase_uid: 'uid-kamala', full_name: 'Dup uid', email: 'x3@example.com' },
        { firebase_uid: 'uid-x4', full_name: 'Big no', email: 'x4@example.com', staff_no: 1000 },
        { firebase_uid: 'uid-x5', full_name: '', email: 'x5@example.com' },
        { firebase_uid: 'uid-x6', full_name: 'No at', email: 'x6.example.com' },
        { firebase_uid: 'uid-x7', full_name: 'Role', email: 'x7@example.com', role: 'super_admin' },
      ]) {
        await expect(onboard(bad)).rejects.toThrow(/SEVA:validation/);
      }
    });

    it('needs a reason to deactivate or delete, and audits each status change', async () => {
      const id = await seedStaff(db, { staffNo: 50, name: 'Ramesh', uid: 'uid-ramesh-50' });

      await expect(update(id, { status: 'inactive' }, null)).rejects.toThrow(/SEVA:validation/);
      await expect(update(id, { status: 'inactive' }, 'no')).rejects.toThrow(/SEVA:validation/);
      await update(id, { status: 'inactive' }, 'Left the temple service');
      expect(
        await one(db, `select status, status_reason, status_changed_by_staff_id, status_changed_at is not null as at from staff where id = $1`, [id]),
      ).toEqual({ status: 'inactive', status_reason: 'Left the temple service', status_changed_by_staff_id: admin, at: true });
      const deact = await auditRows(db, 'staff.deactivate', id);
      expect(deact).toHaveLength(1);
      expect(deact[0]).toMatchObject({ reason: 'Left the temple service', before: { status: 'active' }, after: { status: 'inactive' } });

      await update(id, { status: 'active' }, null);
      expect((await one<{ status: string }>(db, `select status from staff where id = $1`, [id])).status).toBe('active');
      expect(await auditRows(db, 'staff.reactivate', id)).toHaveLength(1);

      await update(id, { view_only: true }, null);
      const vo = await auditRows(db, 'staff.view_only_change', id);
      expect(vo).toHaveLength(1);
      expect(vo[0]).toMatchObject({ before: { view_only: false }, after: { view_only: true } });

      await expect(update(id, { status: 'deleted' }, '')).rejects.toThrow(/SEVA:validation/);
      await update(id, { status: 'deleted' }, 'Duplicate account');
      expect((await one<{ status: string }>(db, `select status from staff where id = $1`, [id])).status).toBe('deleted');
      expect(await auditRows(db, 'staff.delete', id)).toHaveLength(1);

      await expect(update(id, { status: 'active' }, 'Came back')).rejects.toThrow(/SEVA:validation/);
      await expect(update(id, { status: 'invited' }, 'x y z')).rejects.toThrow(/SEVA:validation/);
      await expect(update(id, { role: 'super_admin' }, null)).rejects.toThrow(/SEVA:validation/);
      await expect(update('00000000-0000-4000-8000-000000000000', { view_only: true }, null)).rejects.toThrow(
        /SEVA:not_found/,
      );
    });

    it('mark signed in moves invited to active once', async () => {
      const id = await seedStaff(db, { staffNo: 60, name: 'New Person', uid: 'uid-new-60', status: 'invited' });
      await svc(db, `select seva_mark_signed_in($1::uuid)`, [id]);
      const first = await one<{ status: string; at: string }>(
        db,
        `select status, first_signed_in_at::text as at from staff where id = $1`,
        [id],
      );
      expect(first.status).toBe('active');
      expect(first.at).not.toBeNull();
      await svc(db, `select seva_mark_signed_in($1::uuid)`, [id]);
      expect(await one(db, `select status, first_signed_in_at::text as at from staff where id = $1`, [id])).toEqual(first);

      // An inactive person is never switched back on by signing in.
      const gone = await seedStaff(db, { staffNo: 61, name: 'Gone', uid: 'uid-gone-61', status: 'invited' });
      await db.query(`update staff set status = 'inactive', status_reason = 'Left' where id = $1`, [gone]);
      await svc(db, `select seva_mark_signed_in($1::uuid)`, [gone]);
      expect((await one<{ status: string }>(db, `select status from staff where id = $1`, [gone])).status).toBe('inactive');

      await expect(svc(db, `select seva_mark_signed_in('00000000-0000-4000-8000-000000000000'::uuid)`)).rejects.toThrow(
        /SEVA:not_found/,
      );
    });
  });

  describe('devotee profiles', () => {
    it('purges profiles unseen for three years', async () => {
      await db.query(
        `insert into devotee_profiles (phone_e164, name, last_seen_at) values
           ('+919845012345', 'Old Devotee', now() - interval '3 years' - interval '1 day'),
           ('+919845012346', 'Recent Devotee', now() - interval '2 years')`,
      );
      const [{ n }] = await svc<{ n: number }>(db, `select seva_purge_devotee_profiles() as n`);
      expect(n).toBe(1);
      const left = await db.query<{ name: string }>(`select name from devotee_profiles`);
      expect(left.rows).toEqual([{ name: 'Recent Devotee' }]);
    });
  });

  it('lets only service_role execute the admin functions', async () => {
    const sigs = [
      'seva_upsert_seva(jsonb,text,uuid)',
      'seva_reorder_sevas(uuid[],uuid)',
      'seva_update_settings(jsonb,uuid)',
      'seva_save_denominations(jsonb,uuid)',
      'seva_save_festival(jsonb,uuid)',
      'seva_add_counter(text,text,uuid)',
      'seva_update_counter(smallint,jsonb,uuid)',
      'seva_staff_onboard(jsonb,uuid)',
      'seva_staff_update(uuid,jsonb,text,uuid)',
      'seva_mark_signed_in(uuid)',
      'seva_purge_devotee_profiles()',
    ];
    for (const sig of sigs) {
      const priv = await one(
        db,
        `select has_function_privilege('anon', $1, 'EXECUTE') as anon,
                has_function_privilege('authenticated', $1, 'EXECUTE') as auth,
                has_function_privilege('service_role', $1, 'EXECUTE') as service`,
        [sig],
      );
      expect({ sig, ...priv }).toEqual({ sig, anon: false, auth: false, service: true });
    }
    await expect(asRole(db, 'anon', (d) => d.query(`select seva_purge_devotee_profiles()`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('keeps the seed helper sevas usable alongside the admin functions', async () => {
    const id = await seedSeva(db, { code: 'SEE', nameEn: 'Seeded', amount: '20.00' });
    await upsertSeva(db, { id, amount: '25.00' }, 'Office revision', admin);
    expect((await one<{ amount: string }>(db, `select amount::text as amount from sevas where id = $1`, [id])).amount).toBe(
      '25.00',
    );
  });
});
