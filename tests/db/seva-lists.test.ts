/**
 * Task A4P-5 - the gotra, nakshatra and rashi lists (supabase/migrations/20261030000000_seva_lists.sql).
 *
 * Temple admins add gotras and correct names; nakshatra and rashi names are fixed except their Kannada spelling.
 * Nothing is ever deleted (receipts keep gotra_id), every change is audited as settings.list_item, and saving a
 * Kannada name marks it checked (the temple's proof-reading, O-03). Functions are called as service_role, the only
 * role allowed to execute them.
 */
import type { PGlite } from '@electric-sql/pglite';
import { GOTRAS } from '@/lib/seva/domain/gotras';
import { NAKSHATRAS } from '@/lib/seva/domain/nakshatras';
import { RASHIS } from '@/lib/seva/domain/rashis';
import { applyMigrationFile, asRole, freshDb } from './harness';
import { seedStaff } from './fixtures';

type Row = Record<string, unknown>;

async function save(db: PGlite, item: Record<string, unknown>, staffId: string): Promise<Row> {
  return asRole(db, 'service_role', async (d) => {
    const r = await d.query<{ item: Row }>(`select seva_list_item_save($1::jsonb, $2::uuid) as item`, [
      JSON.stringify(item),
      staffId,
    ]);
    return r.rows[0].item;
  });
}

async function listItem(db: PGlite, kind: string, id: number): Promise<Row | undefined> {
  const r = await db.query<Row>(
    `select kind, item_id, name_en, name_kn, kn_checked, active, display_order, updated_by
       from seva_list_items where kind = $1 and item_id = $2`,
    [kind, id],
  );
  return r.rows[0];
}

async function audits(db: PGlite, entityId: string): Promise<Row[]> {
  const r = await db.query<Row>(
    `select action, entity, entity_id, before, after, actor_staff_id
       from audit_log where action = 'settings.list_item' and entity_id = $1 order by id`,
    [entityId],
  );
  return r.rows;
}

describe('seva lists (A4P-5)', () => {
  let db: PGlite;
  let admin: string;
  let invited: string;

  beforeAll(async () => {
    db = await freshDb();
    admin = await seedStaff(db, { staffNo: 8, name: 'Prakash', uid: 'uid-prakash' });
    invited = await seedStaff(db, { staffNo: 9, name: 'Not yet', uid: 'uid-invited', status: 'invited' });
  });

  afterAll(async () => {
    await db.close();
  });

  it('seeds the built-in lists with the ids the code uses, unchecked', async () => {
    const rows = await asRole(db, 'service_role', async (d) => {
      const r = await d.query<{ items: Row[] }>(`select seva_list_items_get() as items`);
      return r.rows[0].items;
    });
    const of = (kind: string) => rows.filter((r) => r.kind === kind);
    expect(of('gotra').map((r) => [r.item_id, r.name_en, r.name_kn])).toEqual(GOTRAS.map((g) => [g.id, g.en, g.kn]));
    expect(of('nakshatra').map((r) => [r.item_id, r.name_en, r.name_kn])).toEqual(NAKSHATRAS.map((n) => [n.id, n.en, n.kn]));
    expect(of('rashi').map((r) => [r.item_id, r.name_en, r.name_kn])).toEqual(RASHIS.map((n) => [n.id, n.en, n.kn]));
    expect(rows.every((r) => r.kn_checked === false && r.active === true)).toBe(true);
  });

  it('adds a gotra with the next id from 1000 and logs it', async () => {
    const first = await save(db, { kind: 'gotra', name_en: '  Vyaghrapada ', name_kn: 'ವ್ಯಾಘ್ರಪಾದ' }, admin);
    expect(first).toMatchObject({ kind: 'gotra', item_id: 1000, name_en: 'Vyaghrapada', name_kn: 'ವ್ಯಾಘ್ರಪಾದ', kn_checked: true, active: true });
    const second = await save(db, { kind: 'gotra', name_en: 'Kutsa Angirasa' }, admin);
    expect(second).toMatchObject({ item_id: 1001, name_kn: null, kn_checked: false, active: true });

    const row = await listItem(db, 'gotra', 1000);
    expect(row).toMatchObject({ name_en: 'Vyaghrapada', updated_by: admin });
    expect(Number(row?.display_order)).toBeGreaterThan(56);

    const logged = await audits(db, 'gotra:1000');
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ entity: 'seva_list_items', actor_staff_id: admin, before: null });
    expect(logged[0].after).toMatchObject({ name_en: 'Vyaghrapada', name_kn: 'ವ್ಯಾಘ್ರಪಾದ', kn_checked: true, active: true });

    // Only an active staff member may change the lists.
    await expect(save(db, { kind: 'gotra', name_en: 'Someone else' }, invited)).rejects.toThrow(/SEVA:staff_inactive/);
  });

  it("refuses a change to a nakshatra name but saves its Kannada and marks it checked", async () => {
    await expect(save(db, { kind: 'nakshatra', item_id: 25, name_en: 'Poorva Bhadra' }, admin)).rejects.toThrow(/SEVA:validation/);
    await expect(save(db, { kind: 'nakshatra', item_id: 25, active: false }, admin)).rejects.toThrow(/SEVA:validation/);
    await expect(save(db, { kind: 'rashi', name_kn: 'ಹೊಸ' }, admin)).rejects.toThrow(/SEVA:validation/);
    await expect(save(db, { kind: 'rashi', item_id: 13, name_kn: 'ಹೊಸ' }, admin)).rejects.toThrow(/SEVA:not_found/);
    expect(await listItem(db, 'nakshatra', 25)).toMatchObject({ name_en: 'Purva Bhadrapada', active: true, kn_checked: false });

    const saved = await save(db, { kind: 'nakshatra', item_id: 25, name_kn: 'ಪೂರ್ವಾಭಾದ್ರಪದ' }, admin);
    expect(saved).toMatchObject({ item_id: 25, name_en: 'Purva Bhadrapada', name_kn: 'ಪೂರ್ವಾಭಾದ್ರಪದ', kn_checked: true });

    // Saving the same spelling again is how an admin confirms it: the rashi turns checked with its name unchanged.
    const rashi = await save(db, { kind: 'rashi', item_id: 1, name_kn: 'ಮೇಷ' }, admin);
    expect(rashi).toMatchObject({ name_kn: 'ಮೇಷ', kn_checked: true });

    const logged = await audits(db, 'nakshatra:25');
    expect(logged).toHaveLength(1);
    expect(logged[0].before).toEqual({ name_kn: 'ಪೂರ್ವಾಭಾದ್ರ', kn_checked: false });
    expect(logged[0].after).toEqual({ name_kn: 'ಪೂರ್ವಾಭಾದ್ರಪದ', kn_checked: true });
  });

  it('refuses a duplicate gotra name', async () => {
    await expect(save(db, { kind: 'gotra', name_en: 'kashyapa' }, admin)).rejects.toThrow(/SEVA:validation/);
    await expect(save(db, { kind: 'gotra', name_en: ' VYAGHRAPADA ' }, admin)).rejects.toThrow(/SEVA:validation/);
    await expect(save(db, { kind: 'gotra', item_id: 1000, name_en: 'Bharadwaja' }, admin)).rejects.toThrow(/SEVA:validation/);
    // Renaming a gotra to its own name in another case is not a duplicate.
    const renamed = await save(db, { kind: 'gotra', item_id: 1000, name_en: 'VyaghraPada' }, admin);
    expect(renamed).toMatchObject({ item_id: 1000, name_en: 'VyaghraPada' });
    const count = await db.query<{ n: number }>(`select count(*)::int as n from seva_list_items where kind = 'gotra'`);
    expect(count.rows[0].n).toBe(GOTRAS.length + 2);
  });

  it('hides a gotra without deleting it', async () => {
    const hidden = await save(db, { kind: 'gotra', item_id: 12, active: false }, admin);
    expect(hidden).toMatchObject({ item_id: 12, name_en: 'Shandilya', active: false });
    expect(await listItem(db, 'gotra', 12)).toMatchObject({ active: false, name_en: 'Shandilya' });
    const logged = await audits(db, 'gotra:12');
    expect(logged.map((a) => [a.before, a.after])).toEqual([[{ active: true }, { active: false }]]);

    // A hidden gotra still blocks its name, and shows again on request.
    await expect(save(db, { kind: 'gotra', name_en: 'Shandilya' }, admin)).rejects.toThrow(/SEVA:validation/);
    expect(await save(db, { kind: 'gotra', item_id: 12, active: true }, admin)).toMatchObject({ active: true });

    // Nothing deletes a row: there is no delete function, and the service role holds no DELETE.
    const fns = await db.query<{ n: number }>(`select count(*)::int as n from pg_proc where proname like 'seva_list_item%delete%'`);
    expect(fns.rows[0].n).toBe(0);
    await expect(
      asRole(db, 'service_role', (d) => d.query(`delete from seva_list_items where kind = 'gotra' and item_id = 12`)),
    ).rejects.toThrow(/permission denied/);
  });

  it('runs again without undoing an admin change', async () => {
    await applyMigrationFile(db, '20261030000000_seva_lists.sql');
    expect(await listItem(db, 'nakshatra', 25)).toMatchObject({ name_kn: 'ಪೂರ್ವಾಭಾದ್ರಪದ', kn_checked: true });
    expect(await listItem(db, 'gotra', 1000)).toMatchObject({ name_en: 'VyaghraPada' });
  });

  it('no role but the service role can read or write the table', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(asRole(db, role, (d) => d.query(`select * from seva_list_items`))).rejects.toThrow(/permission denied/);
      await expect(
        asRole(db, role, (d) =>
          d.query(`insert into seva_list_items (kind, item_id, name_en, display_order) values ('gotra', 2000, 'X', 2000)`),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(asRole(db, role, (d) => d.query(`select seva_list_items_get()`))).rejects.toThrow(/permission denied/);
      await expect(
        asRole(db, role, (d) => d.query(`select seva_list_item_save('{"kind":"gotra","name_en":"Y"}'::jsonb, $1::uuid)`, [admin])),
      ).rejects.toThrow(/permission denied/);
    }

    const r = await db.query<Row>(
      `select has_table_privilege('service_role', 'public.seva_list_items', 'SELECT') as sel,
              has_table_privilege('service_role', 'public.seva_list_items', 'INSERT') as ins,
              has_table_privilege('service_role', 'public.seva_list_items', 'UPDATE') as upd,
              has_table_privilege('service_role', 'public.seva_list_items', 'DELETE') as del,
              has_table_privilege('service_role', 'public.seva_list_items', 'TRUNCATE') as trunc,
              has_table_privilege('service_role', 'public.seva_list_items', 'TRIGGER') as trig,
              has_table_privilege('service_role', 'public.seva_list_items', 'REFERENCES') as refs,
              (select relrowsecurity from pg_class where oid = 'public.seva_list_items'::regclass) as rls`,
    );
    expect(r.rows[0]).toEqual({ sel: true, ins: true, upd: true, del: false, trunc: false, trig: false, refs: false, rls: true });
  });
});
