/**
 * Seed helpers for the seva database tests.
 *
 * They write straight into the tables as the database owner (PGlite's
 * superuser), so they skip the service-role functions on purpose: use them only
 * to set up a test's starting state, never to prove a business rule.
 */
import { createHash, randomBytes } from 'crypto';
import type { PGlite } from '@electric-sql/pglite';

/** Inserts a staff member (default status `active`) and returns its id. The email is derived from the uid. */
export async function seedStaff(
  db: PGlite,
  p: { staffNo: number; name: string; uid: string; status?: 'invited' | 'active' },
): Promise<string> {
  const status = p.status ?? 'active';
  const r = await db.query<{ id: string }>(
    `insert into staff (firebase_uid, staff_no, full_name, email, status, first_signed_in_at)
     values ($1, $2::smallint, $3, $4, $5, $6::timestamptz)
     returning id`,
    [p.uid, p.staffNo, p.name, `${p.uid.toLowerCase()}@example.test`, status, status === 'active' ? new Date().toISOString() : null],
  );
  return r.rows[0].id;
}

/**
 * Inserts a catalogue seva and returns its id. `amount: null` means an any-amount seva (stored as 0.00 with
 * `any_amount = true`, counter-only unless `visibility` says otherwise). `key` is the counter key, which is the
 * display order; it defaults to the next free position.
 */
export async function seedSeva(
  db: PGlite,
  p: {
    code: string;
    nameEn: string;
    amount: string | null;
    key?: number;
    multiDate?: boolean;
    anyAmount?: boolean;
    visibility?: 'counter' | 'online' | 'both';
    allowAmountChange?: boolean;
    prasadamGiven?: boolean;
  },
): Promise<string> {
  const anyAmount = p.anyAmount ?? p.amount === null;
  const visibility = p.visibility ?? (anyAmount ? 'counter' : 'both');
  const r = await db.query<{ id: string }>(
    `insert into sevas (name, description, category, amount, display_order, code, multi_date, any_amount,
                        visibility, allow_amount_change, prasadam_given)
     values ($1, '', 'Seva', $2::numeric,
             coalesce($3::int, (select coalesce(max(display_order), 0) + 1 from sevas)),
             $4, $5::boolean, $6::boolean, $7, $8::boolean, $9::boolean)
     returning id`,
    [
      p.nameEn,
      p.amount ?? '0.00',
      p.key ?? null,
      p.code,
      p.multiDate ?? false,
      anyAmount,
      visibility,
      p.allowAmountChange ?? true,
      p.prasadamGiven ?? true,
    ],
  );
  return r.rows[0].id;
}

/** Registers a live device on a counter (default Counter 1) and returns its id. */
export async function seedDevice(
  db: PGlite,
  p: { counterId?: number; staffId: string; secretHash?: string },
): Promise<string> {
  const secretHash = p.secretHash ?? createHash('sha256').update(randomBytes(32)).digest('hex');
  const r = await db.query<{ id: string }>(
    `insert into counter_devices (counter_id, secret_hash, label, registered_by_staff_id)
     values ($1::smallint, $2, 'Test PC', $3::uuid)
     returning id`,
    [p.counterId ?? 1, secretHash, p.staffId],
  );
  return r.rows[0].id;
}
