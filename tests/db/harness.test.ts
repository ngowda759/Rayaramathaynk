import type { PGlite } from '@electric-sql/pglite';
import { asRole, freshDb, sevaMigrationFiles } from './harness';

function count(table: string): (db: PGlite) => Promise<number> {
  return async (db) => {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from ${table}`);
    return r.rows[0].n;
  };
}

describe('PGlite database harness', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
  });

  afterAll(async () => {
    await db.close();
  });

  it('creates the three Supabase roles', async () => {
    const r = await db.query<{ rolname: string }>(
      `select rolname from pg_roles where rolname in ('anon','authenticated','service_role') order by 1`,
    );
    expect(r.rows.map((x) => x.rolname)).toEqual(['anon', 'authenticated', 'service_role']);
  });

  it('service_role bypasses RLS and anon does not', async () => {
    await db.exec(`
      create table harness_rls_probe (id int);
      alter table harness_rls_probe enable row level security;
      create policy "Deny all public access to harness_rls_probe" on harness_rls_probe
        for all to public using (false) with check (false);
      insert into harness_rls_probe (id) values (1);
    `);
    expect(await asRole(db, 'service_role', count('harness_rls_probe'))).toBe(1);
    expect(await asRole(db, 'anon', count('harness_rls_probe'))).toBe(0);
  });

  it('has the base objects the seva files depend on', async () => {
    const r = await db.query<{ sevas: string | null; trigger_fn: string | null }>(
      `select to_regclass('public.sevas')::text as sevas,
              to_regprocedure('update_updated_at_column()')::text as trigger_fn`,
    );
    expect(r.rows[0].sevas).not.toBeNull();
    expect(r.rows[0].trigger_fn).not.toBeNull();
  });

  it('lists seva migrations in name order', () => {
    expect(sevaMigrationFiles()).toEqual([...sevaMigrationFiles()].sort());
  });
});
