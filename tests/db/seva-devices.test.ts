import { createHash, randomBytes } from 'crypto';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb } from './harness';
import { seedDevice, seedStaff } from './fixtures';

// Counter devices, receipt-number gaps and the heartbeat (DB 8.3-8.5, C-52):
// seva_register_device, seva_replace_device, seva_resolve_gap, seva_heartbeat.

interface DeviceRow {
  id: string;
  counter_id: number;
  label: string | null;
  registered_by_staff_id: string;
  retired_at: string | null;
  retired_by_staff_id: string | null;
  retired_reason: string | null;
}

interface GapRow {
  id: string;
  series_code: string;
  year: number;
  from_no: number;
  to_no: number;
  cause: string;
  status: string;
  resolved_at: string | null;
  resolved_by_staff_id: string | null;
  resolution_note: string | null;
}

function secretHash(): string {
  return createHash('sha256').update(randomBytes(32)).digest('hex');
}

async function istYear(db: PGlite): Promise<number> {
  const r = await db.query<{ year: number }>('select year from seva_ist_parts(now())');
  return r.rows[0].year;
}

async function setOfLastNo(db: PGlite, lastNo: number): Promise<void> {
  await db.query(
    `insert into receipt_series_years (series_code, year, last_no)
     select 'OF1', year, $1::int from seva_ist_parts(now())
     on conflict (series_code, year) do update set last_no = excluded.last_no`,
    [lastNo],
  );
}

async function ofLastNo(db: PGlite): Promise<number | null> {
  const r = await db.query<{ last_no: number }>(
    `select y.last_no from receipt_series_years y, seva_ist_parts(now()) p
      where y.series_code = 'OF1' and y.year = p.year`,
  );
  return r.rows[0]?.last_no ?? null;
}

async function devices(db: PGlite): Promise<DeviceRow[]> {
  const r = await db.query<DeviceRow>(
    `select id, counter_id, label, registered_by_staff_id, retired_at::text, retired_by_staff_id, retired_reason
       from counter_devices order by registered_at, id`,
  );
  return r.rows;
}

async function gaps(db: PGlite): Promise<GapRow[]> {
  const r = await db.query<GapRow>(
    `select id::text, series_code, year, from_no, to_no, cause, status, resolved_at::text, resolved_by_staff_id,
            resolution_note
       from receipt_number_gaps order by id`,
  );
  return r.rows;
}

async function audits(db: PGlite, action: string): Promise<{ entity_id: string | null; actor_staff_id: string | null; reason: string | null; after: Record<string, unknown> | null }[]> {
  const r = await db.query<{ entity_id: string | null; actor_staff_id: string | null; reason: string | null; after: Record<string, unknown> | null }>(
    `select entity_id, actor_staff_id, reason, after from audit_log where action = $1 order by id`,
    [action],
  );
  return r.rows;
}

async function register(db: PGlite, staffId: string, hash = secretHash(), counterId = 1): Promise<string> {
  const r = await db.query<{ id: string }>(
    `select seva_register_device($1::smallint, $2, 'Office PC', $3::uuid) as id`,
    [counterId, hash, staffId],
  );
  return r.rows[0].id;
}

async function replace(db: PGlite, staffId: string, lastPrinted: number, reason = 'Old PC stopped working'): Promise<string> {
  const r = await db.query<{ id: string }>(
    `select seva_replace_device(1::smallint, $1, 'New office PC', $2::int, $3, $4::uuid) as id`,
    [secretHash(), lastPrinted, reason, staffId],
  );
  return r.rows[0].id;
}

describe('seva device, gap and heartbeat functions (A2-2)', () => {
  let db: PGlite;
  let admin: string;

  beforeEach(async () => {
    db = await freshDb();
    admin = await seedStaff(db, { staffNo: 1, name: 'Admin', uid: 'uid-admin' });
  });

  afterEach(async () => {
    await db.close();
  });

  it('registers one live device per counter', async () => {
    const hash = secretHash();
    const id = await register(db, admin, hash);
    const rows = await devices(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, counter_id: 1, label: 'Office PC', registered_by_staff_id: admin, retired_at: null });
    const stored = await db.query<{ secret_hash: string }>('select secret_hash from counter_devices where id = $1::uuid', [id]);
    expect(stored.rows[0].secret_hash).toBe(hash);

    await expect(register(db, admin)).rejects.toThrow('SEVA:device_exists');
    expect(await devices(db)).toHaveLength(1);

    const audit = await audits(db, 'device.register');
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ entity_id: id, actor_staff_id: admin });
    expect(JSON.stringify(audit[0].after)).not.toContain(hash);

    await expect(register(db, admin, 'not-a-hash', 1)).rejects.toThrow('SEVA:validation');
    await expect(register(db, admin, secretHash(), 9)).rejects.toThrow('SEVA:not_found');
    await db.query(`update staff set status = 'inactive', status_reason = 'Left' where id = $1::uuid`, [admin]);
    await expect(register(db, admin)).rejects.toThrow('SEVA:staff_inactive');
  });

  it('replace retires the old device, raises the OF floor and opens a device_replaced gap', async () => {
    const oldId = await seedDevice(db, { staffId: admin });
    await setOfLastNo(db, 5);

    const newId = await replace(db, admin, 9);
    expect(newId).not.toBe(oldId);

    const rows = await devices(db);
    const oldRow = rows.find((d) => d.id === oldId);
    const newRow = rows.find((d) => d.id === newId);
    expect(oldRow).toMatchObject({ retired_by_staff_id: admin, retired_reason: 'Old PC stopped working' });
    expect(oldRow?.retired_at).not.toBeNull();
    expect(newRow).toMatchObject({ counter_id: 1, label: 'New office PC', retired_at: null });

    expect(await ofLastNo(db)).toBe(9);
    const year = await istYear(db);
    expect(await gaps(db)).toEqual([
      expect.objectContaining({ series_code: 'OF1', year, from_no: 6, to_no: 9, cause: 'device_replaced', status: 'open' }),
    ]);

    const audit = await audits(db, 'device.replace');
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ entity_id: newId, actor_staff_id: admin, reason: 'Old PC stopped working' });

    await expect(replace(db, admin, 9, '')).rejects.toThrow('SEVA:validation');
    await expect(replace(db, admin, -1)).rejects.toThrow('SEVA:validation');
  });

  it('replace with the server\'s own last number opens no gap', async () => {
    await seedDevice(db, { staffId: admin });
    await setOfLastNo(db, 5);
    await replace(db, admin, 5);
    expect(await gaps(db)).toEqual([]);
    expect(await ofLastNo(db)).toBe(5);

    // A typed number below the server's never lowers the floor.
    await replace(db, admin, 3);
    expect(await gaps(db)).toEqual([]);
    expect(await ofLastNo(db)).toBe(5);

    // The first replace of the year creates the year row.
    const db2 = await freshDb();
    try {
      const a2 = await seedStaff(db2, { staffNo: 1, name: 'Admin', uid: 'uid-admin' });
      await replace(db2, a2, 0);
      expect(await ofLastNo(db2)).toBe(0);
      expect(await gaps(db2)).toEqual([]);
      expect((await devices(db2)).filter((d) => d.retired_at === null)).toHaveLength(1);
    } finally {
      await db2.close();
    }
  });

  it('resolving a gap needs a note and records who and when', async () => {
    await seedDevice(db, { staffId: admin });
    await setOfLastNo(db, 5);
    await replace(db, admin, 9);
    const [gap] = await gaps(db);

    const resolve = (status: string, note: string | null) =>
      db.query(`select seva_resolve_gap($1::bigint, $2, $3, $4::uuid)`, [gap.id, status, note, admin]);

    await expect(resolve('declared_lost', null)).rejects.toThrow('SEVA:validation');
    await expect(resolve('declared_lost', ' ')).rejects.toThrow('SEVA:validation');
    await expect(resolve('received_late', 'Came in late')).rejects.toThrow('SEVA:validation');
    await expect(resolve('open', 'Reopen it')).rejects.toThrow('SEVA:validation');
    await expect(
      db.query(`select seva_resolve_gap(999999::bigint, 'declared_lost', 'Lost with the PC', $1::uuid)`, [admin]),
    ).rejects.toThrow('SEVA:not_found');

    await resolve('declared_lost', 'Slips lost with the old PC');
    const [after] = await gaps(db);
    expect(after).toMatchObject({
      status: 'declared_lost',
      resolved_by_staff_id: admin,
      resolution_note: 'Slips lost with the old PC',
    });
    expect(after.resolved_at).not.toBeNull();

    const audit = await audits(db, 'gap.resolve');
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ entity_id: gap.id, actor_staff_id: admin, reason: 'Slips lost with the old PC' });

    // A resolved gap cannot be resolved again.
    await expect(resolve('entered_from_paper', 'Typed in from paper')).rejects.toThrow('SEVA:validation');
  });

  it('heartbeat stores outbox count, skew and version and returns the OF floor', async () => {
    const deviceId = await seedDevice(db, { staffId: admin });
    await setOfLastNo(db, 7);

    const r = await db.query<{
      r: { server_time: string; of_series: string; last_of_no: number; last_of_group_no: number; day_closed: boolean };
    }>(`select seva_heartbeat($1::uuid, 3, -1500, '1.4.0') as r`, [deviceId]);
    const beat = r.rows[0].r;
    expect(beat.of_series).toBe('OF1');
    expect(beat.last_of_no).toBe(7);
    // No offline group label stored this month yet (the group floor itself is proved in seva-sync.test.ts).
    expect(beat.last_of_group_no).toBe(0);
    expect(beat.day_closed).toBe(false);
    expect(Math.abs(new Date(beat.server_time).getTime() - Date.now())).toBeLessThan(60_000);

    const row = await db.query<{ last_outbox_count: number; last_clock_skew_ms: number; app_version: string; last_seen_at: string | null }>(
      `select last_outbox_count, last_clock_skew_ms, app_version, last_seen_at::text from counter_devices where id = $1::uuid`,
      [deviceId],
    );
    expect(row.rows[0]).toMatchObject({ last_outbox_count: 3, last_clock_skew_ms: -1500, app_version: '1.4.0' });
    expect(row.rows[0].last_seen_at).not.toBeNull();

    // No year row yet: the floor is 0. A closed day is reported.
    const db2 = await freshDb();
    try {
      const a2 = await seedStaff(db2, { staffNo: 1, name: 'Admin', uid: 'uid-admin' });
      const d2 = await seedDevice(db2, { staffId: a2 });
      await db2.query(
        `insert into day_closes (counter_id, business_date, cash_expected, cash_counted, series_ranges, outbox_pending,
                                 closed_by_staff_id, closed_at)
         select 1, business_date, 0, 0, '[]'::jsonb, 0, $1::uuid, now() from seva_ist_parts(now())`,
        [a2],
      );
      const r2 = await db2.query<{ r: { last_of_no: number; day_closed: boolean } }>(
        `select seva_heartbeat($1::uuid, 0, 0, '1.4.0') as r`,
        [d2],
      );
      expect(r2.rows[0].r).toMatchObject({ last_of_no: 0, last_of_group_no: 0, day_closed: true });
    } finally {
      await db2.close();
    }

    // A retired or unknown device is refused.
    await replace(db, admin, 7);
    await expect(db.query(`select seva_heartbeat($1::uuid, 0, 0, '1.4.0')`, [deviceId])).rejects.toThrow(
      'SEVA:device_unknown',
    );
    await expect(
      db.query(`select seva_heartbeat('00000000-0000-4000-8000-000000000000'::uuid, 0, 0, '1.4.0')`),
    ).rejects.toThrow('SEVA:device_unknown');
  });
});
