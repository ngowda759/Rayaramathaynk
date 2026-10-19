import type { PGlite } from '@electric-sql/pglite';
import { freshDb } from './harness';
import { seedDevice, seedSeva, seedStaff } from './fixtures';
import {
  DemoSeedError,
  RECEIPT_RANGES,
  runDemoSeed,
  SeedRpcError,
  type RunOptions,
  type SeedPort,
  type SeedSummary,
} from '../../scripts/seva/seed-demo-data';
import { addDays, businessDate, istParts, istStartOfDay } from '../../lib/seva/time';

// The demo seeder (scripts/seva/seed-demo-data.ts) against PGlite with every seva migration, through the service role
// and only the seva SQL functions, for --days 5. The fixture is a small temple catalogue, staff 001 and Counter 1's PC.

const BUSINESS_ERROR = /^SEVA:([a-z_]+)$/;
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/** The SeedPort on PGlite: named-argument calls cast to each function's declared types, reads as text. */
async function pglitePort(db: PGlite): Promise<SeedPort> {
  await db.exec('SET ROLE service_role');
  const signatures = new Map<string, Map<string, string>>();

  async function signature(fn: string): Promise<Map<string, string>> {
    const known = signatures.get(fn);
    if (known) return known;
    const r = await db.query<{ name: string; type: string }>(
      `select a.name, a.type
         from pg_proc p,
              unnest(p.proargnames, p.proargtypes::oid[]::regtype[]::text[]) as a(name, type)
        where p.proname = $1`,
      [fn],
    );
    const map = new Map(r.rows.map((row) => [row.name, row.type]));
    signatures.set(fn, map);
    return map;
  }

  function serialise(value: unknown, type: string): string | null {
    if (value === null || value === undefined) return null;
    if (type === 'jsonb') return JSON.stringify(value);
    if (type.endsWith('[]') && Array.isArray(value)) return `{${value.map(String).join(',')}}`;
    return String(value);
  }

  return {
    async rpc(fn, args) {
      if (!IDENTIFIER.test(fn)) throw new Error(`bad function ${fn}`);
      const sig = await signature(fn);
      const names = Object.keys(args);
      const types = names.map((name) => {
        const type = sig.get(name);
        if (!type) throw new Error(`${fn} has no argument ${name}`);
        return type;
      });
      const sql = `select ${fn}(${names.map((name, i) => `${name} => $${i + 1}::${types[i]}`).join(', ')}) as result`;
      try {
        const r = await db.query<{ result: unknown }>(sql, names.map((name, i) => serialise(args[name], types[i])));
        return r.rows[0]?.result;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const match = BUSINESS_ERROR.exec(message.trim());
        const detail = (error as { detail?: unknown }).detail;
        throw new SeedRpcError(fn, match ? match[1] : 'database', match ? String(detail ?? '') : message);
      }
    },
    async select(table, columns, filters = {}) {
      if (!IDENTIFIER.test(table) || !columns.every((c) => IDENTIFIER.test(c))) throw new Error('bad identifier');
      const keys = Object.keys(filters);
      keys.forEach((k) => {
        if (!IDENTIFIER.test(k)) throw new Error('bad identifier');
      });
      const where = keys.length > 0 ? ` where ${keys.map((k, i) => `${k}::text = $${i + 1}`).join(' and ')}` : '';
      const r = await db.query<Record<string, unknown>>(
        `select ${columns.map((c) => `${c}::text as ${c}`).join(', ')} from ${table}${where}`,
        keys.map((k) => String(filters[k])),
      );
      return r.rows;
    },
  };
}

interface Card {
  id: string;
  level: 'ok' | 'attention' | 'critical';
  count: number;
  detail: Record<string, unknown>;
}

/** Cards the demo data means to raise; every other data card must stay 'ok'. */
const INTENDED = new Set(['changed_amounts', 'cancellations', 'day_close_difference', 'prasadam_pending']);
/** Cards about the environment, not the data (no backup run, database size). */
const ENVIRONMENT = new Set(['backup', 'database_size']);

const OPTIONS: Omit<RunOptions, 'log'> = {
  days: 5,
  seed: 42,
  again: false,
  dryRun: false,
  staffNo: 1,
  counterId: 1,
  festival: true,
  issuerRole: 'super_admin',
  concurrency: 4,
};

let db: PGlite;
let port: SeedPort;
let summary: SeedSummary;
const today = businessDate(new Date());

async function scalar<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<{ v: T }>(sql, params);
  return r.rows[0].v;
}

beforeAll(async () => {
  db = await freshDb();
  const staffId = await seedStaff(db, { staffNo: 1, name: 'Demo Owner', uid: 'UID-DEMO-001' });
  await seedSeva(db, { code: 'ARC', nameEn: 'Archane', amount: '10.00' });
  await seedSeva(db, { code: 'KUM', nameEn: 'Kumkumarchane', amount: '20.00' });
  await seedSeva(db, { code: 'TUL', nameEn: 'Tulasi Archane', amount: '25.00', prasadamGiven: false });
  await seedSeva(db, { code: 'PAN', nameEn: 'Panchamrutha Abhisheka', amount: '100.00' });
  await seedSeva(db, { code: 'KSH', nameEn: 'Ksheerabhisheka', amount: '150.00' });
  await seedSeva(db, { code: 'HAS', nameEn: 'Hastodaka', amount: '250.00', multiDate: true });
  await seedSeva(db, { code: 'VAS', nameEn: 'Vastra Samarpane', amount: '500.00', allowAmountChange: false });
  await seedSeva(db, { code: 'RAT', nameEn: 'Rathotsava', amount: '1500.00', multiDate: true });
  await seedSeva(db, { code: 'SAR', nameEn: 'Sarva Seva', amount: '2500.00', multiDate: true });
  await seedSeva(db, { code: 'ANN', nameEn: 'Annadana', amount: null });
  await seedSeva(db, { code: 'WEB', nameEn: 'Online Pooja', amount: '300.00', visibility: 'online' });
  await seedDevice(db, { staffId });
  port = await pglitePort(db);
  summary = await runDemoSeed(port, { ...OPTIONS, log: () => undefined });
}, 600_000);

afterAll(async () => {
  await db?.close();
});

describe('seva demo seed (--days 5)', () => {
  it('issues the planned receipts per business date, each within its kind of day', async () => {
    const r = await db.query<{ d: string; n: number }>(
      'select business_date::text as d, count(*)::int as n from seva_receipts group by 1 order by 1',
    );
    const actual = new Map(r.rows.map((row) => [row.d, row.n]));
    expect(summary.days.map((d) => d.date)).toEqual([...Array.from({ length: 5 }, (_, i) => addDays(today, i - 5)), today]);
    for (const day of summary.days) {
      const kind = day.kind === 'today' ? (istParts(istStartOfDay(today)).weekday === 7 ? 'sunday' : 'ordinary') : day.kind;
      expect(actual.get(day.date)).toBe(day.receipts);
      expect(day.receipts).toBeGreaterThanOrEqual(RECEIPT_RANGES[kind].min);
      expect(day.receipts).toBeLessThanOrEqual(RECEIPT_RANGES[kind].max);
    }
    expect(summary.festivalDates).toHaveLength(3);
    expect(summary.days.filter((d) => d.kind === 'festival').map((d) => d.date)).toEqual(summary.festivalDates);
    const multi = await scalar<number>(
      `select count(*)::int as v from seva_orders o where o.receipts_count > 1
          and exists (select 1 from seva_receipts r where r.order_id = o.id and r.business_date = any($1::date[]))`,
      [`{${summary.festivalDates.join(',')}}`],
    );
    expect(multi).toBeGreaterThan(0);
    expect(await scalar<number>(`select count(*)::int as v from seva_receipts where seva_date > business_date`)).toBeGreaterThan(0);
  });

  it('past days come through the OF series with their past issue time, today through the C series', async () => {
    const r = await db.query<{ series_code: string; past: boolean; n: number }>(
      `select series_code, business_date < $1::date as past, count(*)::int as n from seva_receipts group by 1, 2 order by 1, 2`,
      [today],
    );
    expect(r.rows).toEqual([
      { series_code: 'C1', past: false, n: summary.days[5].receipts },
      { series_code: 'OF1', past: true, n: summary.days.slice(0, 5).reduce((n, d) => n + d.receipts, 0) },
    ]);
    // The business date is the IST date of the issue time, and nothing is dated after it reached the server.
    expect(await scalar<number>(
      `select count(*)::int as v from seva_receipts r join seva_orders o on o.id = r.order_id
        where r.business_date <> (r.issued_at at time zone 'Asia/Kolkata')::date or r.issued_at > o.received_at`,
    )).toBe(0);
  });

  it('keeps every receipt number continuous per series and year, with no gap', async () => {
    const r = await db.query<{ series_code: string; first: number; last: number; n: number }>(
      `select series_code, min(running_no)::int as first, max(running_no)::int as last, count(*)::int as n
         from seva_receipts group by series_code, year`,
    );
    expect(r.rows.length).toBe(2);
    for (const row of r.rows) {
      expect(row.first).toBe(1);
      expect(row.last).toBe(row.n);
    }
    expect(await scalar<number>('select count(*)::int as v from receipt_number_gaps')).toBe(0);
    const continuity = await db.query<{ open_gaps: number }>(
      'select open_gaps from seva_continuity($1::date, $2::date)',
      [addDays(today, -5), today],
    );
    expect(continuity.rows.every((row) => row.open_gaps === 0)).toBe(true);
  });

  it('closes every past day - two with a small difference and a note - and leaves today open', async () => {
    const r = await db.query<{ d: string; status: string; diff: string; upi: string; note: string | null }>(
      `select business_date::text as d, status, (cash_counted - cash_expected)::text as diff,
              (upi_bank_total - upi_expected)::text as upi, note
         from day_closes where counter_id = 1 order by business_date`,
    );
    expect(r.rows.map((row) => row.d)).toEqual(summary.days.slice(0, 5).map((d) => d.date));
    expect(r.rows.every((row) => row.status === 'closed' && Number(row.upi) === 0)).toBe(true);
    const differences = r.rows.filter((row) => Number(row.diff) !== 0);
    expect(differences.map((row) => Number(row.diff)).sort((a, b) => a - b)).toEqual([-20, 50]);
    expect(differences.every((row) => (row.note ?? '').length >= 3)).toBe(true);
    expect(r.rows.filter((row) => Number(row.diff) === 0).every((row) => row.note === null)).toBe(true);
    expect(summary.totals.dayCloses).toBe(5);
  });

  it('gives prasadam on about 80% of past receipts, cancels about 2% of today, and changes about 3% of prices', async () => {
    const past = await db.query<{ given: number; eligible: number }>(
      `select count(*) filter (where prasadam_state = 'given')::int as given,
              count(*) filter (where prasadam_state in ('given', 'pending'))::int as eligible
         from seva_receipts where seva_date < $1::date and status = 'issued'`,
      [today],
    );
    const share = past.rows[0].given / past.rows[0].eligible;
    expect(share).toBeGreaterThan(0.7);
    expect(share).toBeLessThan(0.9);

    const cancelled = await db.query<{ business_date: string; cancel_reason_code: string; refund_state: string }>(
      `select business_date::text as business_date, cancel_reason_code, refund_state from seva_receipts where status = 'cancelled'`,
    );
    expect(cancelled.rows.length).toBeGreaterThanOrEqual(2);
    expect(cancelled.rows.every((row) => row.business_date === today && row.refund_state === 'done')).toBe(true);
    const byAdmin = await scalar<number>(
      `select count(*)::int as v from audit_log where action = 'receipt.cancel' and (after ->> 'by_admin')::boolean`,
    );
    expect(byAdmin).toBe(cancelled.rows.length - 1);

    const changed = await db.query<{ n: number; reasons: number }>(
      `select count(*)::int as n, count(change_reason)::int as reasons from seva_receipt_lines where amount_changed`,
    );
    expect(changed.rows[0].n).toBeGreaterThan(0);
    expect(changed.rows[0].reasons).toBe(changed.rows[0].n);
    const total = await scalar<number>('select count(*)::int as v from seva_receipts');
    expect(await scalar<number>('select count(*)::int as v from seva_receipts where has_changed_amount')).toBeLessThan(total * 0.08);
  });

  it('makes devotees with list details, fake phones only, and some returning', async () => {
    const orders = await db.query<{ cash: number; n: number; phones: number; details: number; bad_phones: number }>(
      `select count(*) filter (where payment_mode = 'cash')::int as cash, count(*)::int as n,
              count(phone_e164)::int as phones,
              count(*) filter (where gotra_id is not null or nakshatra_id is not null or rashi_id is not null)::int as details,
              count(*) filter (where phone_e164 !~ '^\\+91900000[0-9]{4}$')::int as bad_phones
         from seva_orders`,
    );
    const o = orders.rows[0];
    expect(o.cash / o.n).toBeGreaterThan(0.55);
    expect(o.cash / o.n).toBeLessThan(0.85);
    expect(o.phones / o.n).toBeGreaterThan(0.25);
    expect(o.phones / o.n).toBeLessThan(0.55);
    expect(o.details / o.n).toBeGreaterThan(0.35);
    expect(o.details / o.n).toBeLessThan(0.7);
    expect(o.bad_phones).toBe(0);
    expect(await scalar<number>('select count(*)::int as v from devotee_profiles where visit_count > 1')).toBeGreaterThan(0);
  });

  it('gives the dashboard non-zero totals for the week', async () => {
    const to = new Date(Date.now() + 60_000).toISOString();
    for (const from of [istStartOfDay(addDays(today, -6)).toISOString(), istStartOfDay(today).toISOString()]) {
      const dash = await scalar<{ tiles: { total: string; receipts: number; cash: string; upi: string } }>(
        `select seva_dashboard($1::timestamptz, $2::timestamptz, null, null, 'day') as v`,
        [from, to],
      );
      expect(Number(dash.tiles.total)).toBeGreaterThan(0);
      expect(dash.tiles.receipts).toBeGreaterThan(0);
      expect(Number(dash.tiles.cash)).toBeGreaterThan(0);
      expect(Number(dash.tiles.upi)).toBeGreaterThan(0);
    }
  });

  it('raises no Needs attention card beyond the ones the data means to raise', async () => {
    const to = new Date(Date.now() + 60_000).toISOString();
    const week = await scalar<Card[]>(
      'select seva_needs_attention($1::timestamptz, $2::timestamptz, $3::date) as v',
      [istStartOfDay(addDays(today, -6)).toISOString(), to, today],
    );
    const unexpected = week.filter((c) => c.level !== 'ok' && !INTENDED.has(c.id) && !ENVIRONMENT.has(c.id));
    expect(unexpected).toEqual([]);
    const close = week.find((c) => c.id === 'day_close_difference');
    expect(close).toMatchObject({ count: 2, detail: { short: 1, extra: 1 } });
    for (const id of ['day_not_closed', 'number_gaps', 'future_offline', 'offline_cancels', 'upi_refunds_due', 'in_doubt_duplicates']) {
      expect(week.find((c) => c.id === id)?.level).toBe('ok');
    }

    const todayCards = await scalar<Card[]>(
      'select seva_needs_attention($1::timestamptz, $2::timestamptz, $3::date) as v',
      [istStartOfDay(today).toISOString(), to, today],
    );
    const cancellations = todayCards.find((c) => c.id === 'cancellations');
    expect(cancellations?.count).toBe(summary.totals.cancelled);
    expect(cancellations?.detail.after_window).toBe(0);
    expect(todayCards.filter((c) => c.level !== 'ok' && !INTENDED.has(c.id) && !ENVIRONMENT.has(c.id))).toEqual([]);
  });

  it('records that it ran, refuses a second run without --again, and a dry run writes nothing', async () => {
    const markers = await db.query<{ action: string }>(`select action from audit_log where entity = 'demo_seed' order by id`);
    expect(markers.rows.map((m) => m.action)).toEqual(['demo.seed_started', 'demo.seed_finished']);

    const before = await scalar<number>('select (select count(*) from seva_receipts) + (select count(*) from audit_log) as v');
    await expect(runDemoSeed(port, { ...OPTIONS, log: () => undefined })).rejects.toBeInstanceOf(DemoSeedError);
    const lines: string[] = [];
    const dry = await runDemoSeed(port, { ...OPTIONS, again: true, dryRun: true, log: (l) => lines.push(l) });
    expect(dry.dryRun).toBe(true);
    // Every past day is closed now, so a dry run with --again plans only today.
    expect(dry.skippedDates).toHaveLength(5);
    expect(dry.days.map((d) => d.kind)).toEqual(['today']);
    expect(lines.some((l) => l.startsWith(today))).toBe(true);
    expect(await scalar<number>('select (select count(*) from seva_receipts) + (select count(*) from audit_log) as v')).toBe(before);
  });
});
