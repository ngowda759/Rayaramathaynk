/**
 * Task A4S-7 - the receipt paper size setting (supabase/migrations/20261031000000_seva_paper_size.sql).
 *
 * The setting lives on the one seva_settings row and changes only through seva_update_settings, which audits it like
 * the other slip settings. Called as service_role, the only role allowed to execute it.
 */
import type { PGlite } from '@electric-sql/pglite';
import { applyMigrationFile, asRole, freshDb, sevaMigrationFiles } from './harness';
import { seedStaff } from './fixtures';

type Row = Record<string, unknown>;

async function update(db: PGlite, patch: Row, staffId: string): Promise<void> {
  await asRole(db, 'service_role', (d) =>
    d.query(`select seva_update_settings($1::jsonb, $2::uuid)`, [JSON.stringify(patch), staffId]),
  );
}

async function paper(db: PGlite): Promise<Row> {
  return (
    await db.query<Row>(`select paper_size, paper_custom_w_mm, paper_custom_h_mm from seva_settings where id = 1`)
  ).rows[0];
}

describe('seva receipt paper size (A4S-7)', () => {
  let db: PGlite;
  let admin: string;
  let viewer: string;

  beforeAll(async () => {
    db = await freshDb();
    admin = await seedStaff(db, { staffNo: 8, name: 'Prakash', uid: 'uid-prakash' });
    viewer = await seedStaff(db, { staffNo: 9, name: 'Board Member', uid: 'uid-board' });
    await db.query('update staff set view_only = true where id = $1', [viewer]);
  });

  afterAll(async () => {
    await db.close();
  });

  it('defaults paper_size to a5 and refuses an unknown size or a landscape custom size', async () => {
    expect(await paper(db)).toEqual({ paper_size: 'a5', paper_custom_w_mm: null, paper_custom_h_mm: null });

    const refused: Row[] = [
      { paper_size: 'letter' },
      { paper_size: 'custom' },
      { paper_size: 'custom', paper_custom_w_mm: 200, paper_custom_h_mm: 150 },
      { paper_custom_w_mm: 40, paper_custom_h_mm: 150 },
      { paper_custom_w_mm: 100, paper_custom_h_mm: 400 },
      { paper_custom_w_mm: 120, paper_custom_h_mm: 100 },
    ];
    for (const bad of refused) {
      await expect(update(db, bad, admin)).rejects.toThrow(/SEVA:validation/);
    }
    // A direct write is held to the same rules by the table checks.
    await expect(db.query(`update seva_settings set paper_size = 'a4_landscape' where id = 1`)).rejects.toThrow();
    await expect(
      db.query(`update seva_settings set paper_custom_w_mm = 210, paper_custom_h_mm = 148 where id = 1`),
    ).rejects.toThrow();
    expect(await paper(db)).toEqual({ paper_size: 'a5', paper_custom_w_mm: null, paper_custom_h_mm: null });

    for (const size of ['a6', 'third_a4', 'roll_80', 'roll_58', 'a5']) {
      await update(db, { paper_size: size }, admin);
      expect((await paper(db)).paper_size).toBe(size);
    }
    await update(db, { paper_size: 'custom', paper_custom_w_mm: 100, paper_custom_h_mm: 150 }, admin);
    expect(await paper(db)).toEqual({ paper_size: 'custom', paper_custom_w_mm: 100, paper_custom_h_mm: 150 });

    // Audited like the other slip settings, with the changed columns before and after.
    const audit = (
      await db.query<Row>(
        `select before, after, actor_staff_id from audit_log where action = 'settings.update' order by id desc limit 1`,
      )
    ).rows[0];
    expect(audit).toEqual({
      before: { paper_size: 'a5', paper_custom_w_mm: null, paper_custom_h_mm: null },
      after: { paper_size: 'custom', paper_custom_w_mm: 100, paper_custom_h_mm: 150 },
      actor_staff_id: admin,
    });
  });

  it('a view-only temple admin cannot change the paper size', async () => {
    const before = await paper(db);
    const audits = (await db.query<{ n: number }>(`select count(*)::int as n from audit_log`)).rows[0].n;
    await expect(update(db, { paper_size: 'roll_58' }, viewer)).rejects.toThrow(/SEVA:forbidden/);
    expect(await paper(db)).toEqual(before);
    expect((await db.query<{ n: number }>(`select count(*)::int as n from audit_log`)).rows[0].n).toBe(audits);
  });
});

describe('seva receipt paper size is never null (A4S security gate, L-2)', () => {
  const NOT_NULL_FILE = '20261101000000_seva_paper_size_not_null.sql';
  let db: PGlite;
  let admin: string;

  beforeAll(async () => {
    db = await freshDb();
    admin = await seedStaff(db, { staffNo: 8, name: 'Prakash', uid: 'uid-prakash' });
  });

  afterAll(async () => {
    await db.close();
  });

  it('the migration file is one of the seva migrations, after the paper size one', () => {
    const files = sevaMigrationFiles();
    expect(files).toContain(NOT_NULL_FILE);
    expect(files.indexOf(NOT_NULL_FILE)).toBeGreaterThan(files.indexOf('20261031000000_seva_paper_size.sql'));
  });

  it('paper_size is NOT NULL: a direct write and seva_update_settings both refuse a null', async () => {
    const column = (
      await db.query<Row>(
        `select is_nullable, column_default from information_schema.columns
          where table_name = 'seva_settings' and column_name = 'paper_size'`,
      )
    ).rows[0];
    expect(column.is_nullable).toBe('NO');
    expect(String(column.column_default)).toMatch(/'a5'/);

    await expect(db.query(`update seva_settings set paper_size = null where id = 1`)).rejects.toThrow(/null/i);
    await expect(update(db, { paper_size: null }, admin)).rejects.toThrow();
    expect((await paper(db)).paper_size).toBe('a5');
  });

  it('on a database whose row was left null, the migration sets it to a5 and then forbids null', async () => {
    await db.exec(`ALTER TABLE seva_settings ALTER COLUMN paper_size DROP NOT NULL`);
    await db.query(`update seva_settings set paper_size = null where id = 1`);
    expect((await paper(db)).paper_size).toBeNull();

    await applyMigrationFile(db, NOT_NULL_FILE);
    expect((await paper(db)).paper_size).toBe('a5');
    await expect(db.query(`update seva_settings set paper_size = null where id = 1`)).rejects.toThrow(/null/i);

    // Safe to run again.
    await applyMigrationFile(db, NOT_NULL_FILE);
    expect((await paper(db)).paper_size).toBe('a5');
  });
});
