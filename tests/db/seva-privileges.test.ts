/**
 * Privilege hardening (supabase/migrations/20261029235900_seva_privilege_hardening.sql).
 *
 * A role that holds TRIGGER on a guarded table can add its own trigger that runs after a guard and undoes it - for
 * example a BEFORE INSERT trigger on audit_log, named to fire after audit_log_strip_phones, that writes a phone number
 * back. REFERENCES lets a role tie a guarded table to one of its own. Neither is needed by the service role, so no API
 * role may hold either on audit_log or on any seva table that carries guard triggers.
 */
import type { PGlite } from '@electric-sql/pglite';
import { asRole, freshDb } from './harness';

const GUARDED_TABLES = [
  'audit_log',
  'staff',
  'seva_rate_history',
  'seva_orders',
  'seva_receipts',
  'seva_receipt_lines',
  'day_closes',
] as const;

const API_ROLES = ['anon', 'authenticated', 'service_role'] as const;

describe('seva privilege hardening', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
  });

  afterAll(async () => {
    await db.close();
  });

  it('service_role cannot create a trigger on audit_log', async () => {
    await expect(
      asRole(db, 'service_role', (d) =>
        d.exec(`CREATE TRIGGER zz_write_phone_back BEFORE INSERT ON audit_log
                  FOR EACH ROW EXECUTE FUNCTION seva_forbid_change()`),
      ).then(() => undefined),
    ).rejects.toThrow(/permission denied/);
    const t = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_trigger where tgrelid = 'public.audit_log'::regclass and tgname = 'zz_write_phone_back'`,
    );
    expect(t.rows[0].n).toBe(0);
  });

  it('service_role cannot create a trigger on any guarded seva table', async () => {
    for (const table of GUARDED_TABLES) {
      await expect(
        asRole(db, 'service_role', (d) =>
          d.exec(`CREATE TRIGGER zz_probe BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION seva_forbid_change()`),
        ).then(() => undefined),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it('no API role holds TRIGGER or REFERENCES on the guarded tables', async () => {
    for (const role of API_ROLES) {
      for (const table of GUARDED_TABLES) {
        for (const priv of ['TRIGGER', 'REFERENCES']) {
          const r = await db.query<{ has: boolean }>(`select has_table_privilege($1, $2, $3) as has`, [
            role,
            `public.${table}`,
            priv,
          ]);
          expect({ role, table, priv, has: r.rows[0].has }).toEqual({ role, table, priv, has: false });
        }
      }
    }
  });

  it('keeps the service role able to read and write what the app needs', async () => {
    const r = await db.query<{ sel: boolean; ins: boolean; upd: boolean }>(
      `select has_table_privilege('service_role', 'public.seva_receipts', 'SELECT') as sel,
              has_table_privilege('service_role', 'public.audit_log', 'INSERT') as ins,
              has_table_privilege('service_role', 'public.staff', 'UPDATE') as upd`,
    );
    expect(r.rows[0]).toEqual({ sel: true, ins: true, upd: true });
  });
});
