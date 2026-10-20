/**
 * Demo data for a Supabase TEST project: realistic seva receipts, prasadam, cancellations and day closes, so the
 * dashboard, register, reports, charts, day closes and prasadam screens can be tried with real-looking data.
 *
 * Usage, from the repository root:
 *   npx tsx scripts/seva/seed-demo-data.ts --project-ref <ref> --yes-this-is-a-test-project [--days 90] [--dry-run]
 *     [--again] [--seed 108] [--staff-no 1] [--counter 1] [--no-festival]
 * Credentials: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, from the environment or .env.local / .env
 * (read the way create-first-super-admin.ts reads them). No key or secret is ever printed.
 *
 * Guards (each refuses with a plain message and exit code 1): --project-ref must be the project of
 * NEXT_PUBLIC_SUPABASE_URL (host <ref>.supabase.co), --yes-this-is-a-test-project must be given, and NODE_ENV=production,
 * VERCEL or CI refuse the run. A second run refuses unless --again: the first run leaves audit rows demo.seed_started /
 * demo.seed_finished (entity demo_seed) through seva_audit.
 *
 * Everything is written through the module's own SQL functions with the service role, the way the API writes it -
 * no INSERT or UPDATE on a seva table, no new function:
 *   - past business dates: seva_sync_offline_order on the counter's OF series with the past issued_at (the only path
 *     that records a past issue time), numbers continuing the series with no gap, then seva_prepare_day_close and
 *     seva_close_day for the date (most balanced, two with a small difference and a note; with the counter-offline
 *     override and the reason "Demo data seeding", because the counter PC must not be open while the seed runs);
 *   - today: seva_issue_counter_order on the C series (stamped now), seva_record_prints, and a few cancellations
 *     through seva_cancel_receipts (the issuer inside the window, and the admin path);
 *   - prasadam: seva_mark_prasadam (a past seva date is an off-date give, confirmed);
 *   - the Aradhane festival days: seva_save_festival.
 * What the functions cannot produce is left out on purpose: cancellations on past days (an admin cancel stamps now
 * and leaves a refund due; an offline cancel arrives late and is flagged), so only today's receipts are cancelled.
 *
 * Days that already have a day close are never touched. --dry-run reads the project, prints the plan per day and
 * kind, and writes nothing.
 */

import * as path from "path";
import { randomUUID } from "crypto";
import { fromPaise, toPaise } from "../../lib/seva/money";
import { formatOfflineGroupNo, formatReceiptNo } from "../../lib/seva/numbering";
import { newQrToken } from "../../lib/seva/qr";
import { addDays, businessDate, istParts, istStartOfDay } from "../../lib/seva/time";

export class DemoSeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoSeedError";
  }
}

/** A refusal from a seva SQL function: 'SEVA:<code>' with its JSON detail, or a database failure. */
export class SeedRpcError extends Error {
  constructor(
    readonly fn: string,
    readonly code: string,
    readonly detail: string,
  ) {
    super(`${fn} failed: ${code}${detail ? ` ${detail}` : ""}`);
    this.name = "SeedRpcError";
  }
}

// =====================================================================================================================
// Arguments and guards
// =====================================================================================================================

export interface SeedOptions {
  days: number;
  seed: number;
  again: boolean;
  dryRun: boolean;
  staffNo: number;
  counterId: number;
  festival: boolean;
}

export type GuardResult = { kind: "help" } | { kind: "run"; url: string; key: string; options: SeedOptions };

const CONFIRM_FLAG = "--yes-this-is-a-test-project";
export const USAGE =
  "Usage: npx tsx scripts/seva/seed-demo-data.ts --project-ref <ref> --yes-this-is-a-test-project " +
  "[--days 90] [--dry-run] [--again] [--seed 108] [--staff-no 1] [--counter 1] [--no-festival]";
const DEFAULTS: SeedOptions = { days: 90, seed: 108, again: false, dryRun: false, staffNo: 1, counterId: 1, festival: true };

function intArg(name: string, raw: string | undefined, min: number, max: number): number {
  const n = Number(raw);
  if (raw === undefined || !/^[0-9]+$/.test(raw) || !Number.isSafeInteger(n) || n < min || n > max) {
    throw new DemoSeedError(`${name} takes a whole number from ${min} to ${max}. ${USAGE}`);
  }
  return n;
}

function isSet(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== "";
}

/**
 * Reads the arguments and checks every guard against `env`. Throws DemoSeedError with a plain message (never a key or
 * a secret value) when the run must not go ahead.
 */
export function checkGuards(argv: readonly string[], env: Readonly<Record<string, string | undefined>>): GuardResult {
  const options: SeedOptions = { ...DEFAULTS };
  let projectRef: string | null = null;
  let confirmed = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        return { kind: "help" };
      case "--project-ref":
        projectRef = (argv[i + 1] ?? "").trim();
        i += 1;
        break;
      case CONFIRM_FLAG:
        confirmed = true;
        break;
      case "--days":
        options.days = intArg("--days", argv[i + 1], 1, 365);
        i += 1;
        break;
      case "--seed":
        options.seed = intArg("--seed", argv[i + 1], 0, 2_147_483_647);
        i += 1;
        break;
      case "--staff-no":
        options.staffNo = intArg("--staff-no", argv[i + 1], 1, 999);
        i += 1;
        break;
      case "--counter":
        options.counterId = intArg("--counter", argv[i + 1], 1, 99);
        i += 1;
        break;
      case "--again":
        options.again = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--no-festival":
        options.festival = false;
        break;
      default:
        throw new DemoSeedError(`Unknown argument "${arg}". ${USAGE}`);
    }
  }

  if (env.NODE_ENV === "production") {
    throw new DemoSeedError("NODE_ENV is production. Demo data is only for a test project. Nothing was changed.");
  }
  if (isSet(env.VERCEL)) {
    throw new DemoSeedError("VERCEL is set, so this looks like a deployment. Run it on your own PC. Nothing was changed.");
  }
  if (isSet(env.CI)) {
    throw new DemoSeedError("CI is set. The demo seeder never runs in CI. Nothing was changed.");
  }
  if (!projectRef) {
    throw new DemoSeedError(`Name the test project with --project-ref <ref>. ${USAGE}`);
  }
  if (!confirmed) {
    throw new DemoSeedError(`Add ${CONFIRM_FLAG} to confirm the project holds only test data. ${USAGE}`);
  }
  const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url) throw new DemoSeedError("Set NEXT_PUBLIC_SUPABASE_URL (for example in .env.local).");
  if (!key) throw new DemoSeedError("Set SUPABASE_SERVICE_ROLE_KEY (for example in .env.local).");
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    throw new DemoSeedError("NEXT_PUBLIC_SUPABASE_URL is not a valid URL. Nothing was changed.");
  }
  if (host !== `${projectRef.toLowerCase()}.supabase.co`) {
    throw new DemoSeedError(
      "The --project-ref does not match the project in NEXT_PUBLIC_SUPABASE_URL. Nothing was changed.",
    );
  }
  return { kind: "run", url, key, options };
}

// =====================================================================================================================
// The database port: seva SQL functions and plain reads
// =====================================================================================================================

export type Row = Record<string, unknown>;

/** What the seeder needs from the database. main() wires Supabase; the DB test wires PGlite. */
export interface SeedPort {
  /** Calls one seva SQL function with named arguments; throws SeedRpcError on a refusal. */
  rpc(fn: string, args: Record<string, unknown>): Promise<unknown>;
  /** Reads rows of one table, filtered by equality. */
  select(table: string, columns: readonly string[], filters?: Readonly<Record<string, string | number | boolean>>): Promise<Row[]>;
}

// =====================================================================================================================
// Random numbers (seeded, so --dry-run shows the plan a run with the same --seed makes)
// =====================================================================================================================

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** mulberry32: a float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    const total = items.reduce((sum, item) => sum + weight(item), 0);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= weight(item);
      if (roll < 0) return item;
    }
    return items[items.length - 1];
  }
}

// =====================================================================================================================
// The plan
// =====================================================================================================================

export type DayKind = "ordinary" | "sunday" | "festival";

/** Receipts issued per business date, by kind of day. */
export const RECEIPT_RANGES: Readonly<Record<DayKind, { min: number; max: number }>> = {
  ordinary: { min: 20, max: 60 },
  sunday: { min: 60, max: 120 },
  festival: { min: 250, max: 400 },
};

const SHARE_UPI = 0.3;
const SHARE_PRICE_CHANGE = 0.03;
const SHARE_PRASADAM_PAST = 0.8;
const SHARE_PRASADAM_TODAY = 0.55;
const SHARE_CANCEL_TODAY = 0.02;
const SHARE_RETURNING = 0.3;
const SHARE_NEW_WITH_PHONE = 0.15;
const SHARE_NEW_WITH_DETAILS = 0.45;
const REGULARS = 120;
/** Fake phone numbers from a reserved range: +91 90000 0XXXX. */
const PHONE_PREFIX = "+91900000";
const CLOSE_DIFFERENCES = [
  { paise: -2000, note: "Rs 20 short: change given twice during the evening rush" },
  { paise: 5000, note: "Rs 50 extra: a devotee left without taking the change" },
] as const;

export interface SevaInfo {
  id: string;
  code: string;
  name: string;
  /** null for an any-amount seva (the typed amount is the price). */
  ratePaise: number | null;
  allowChange: boolean;
  multiDate: boolean;
}

export interface ListItem {
  id: number;
  name: string;
}

export interface Lists {
  gotras: ListItem[];
  nakshatras: ListItem[];
  rashis: ListItem[];
}

export interface PlanDevotee {
  name: string;
  gotra: ListItem | null;
  nakshatra: ListItem | null;
  rashi: ListItem | null;
  phone: string | null;
}

export interface PlanLine {
  sevaId: string;
  quantity: number;
  /** The catalogue rate (null for an any-amount seva). */
  ratePaise: number | null;
  unitPaise: number;
  changeReason: string | null;
}

export interface PlanReceipt {
  clientReceiptId: string;
  qrToken: string;
  sevaDate: string;
  lines: PlanLine[];
  totalPaise: number;
  changed: boolean;
  givePrasadam: boolean;
  cancel: { byAdmin: boolean; reasonCode: string; note: string | null } | null;
}

export interface PlanOrder {
  clientOrderId: string;
  /** Past days: the PC's issue time. Today: null (the server stamps now). */
  issuedAt: Date | null;
  devotee: PlanDevotee;
  payment: { mode: "cash" | "upi"; cashReceivedPaise: number | null; upiRef: string | null };
  receipts: PlanReceipt[];
}

export interface PlanDay {
  date: string;
  kind: DayKind;
  today: boolean;
  orders: PlanOrder[];
  /** Past days: the cash difference to count at the close (0 = balanced). Today: null (left open). */
  close: { differencePaise: number; note: string | null } | null;
}

export interface DemoPlan {
  today: string;
  festivalDates: string[];
  /** Past dates left alone because they already have a day close. */
  skippedDates: string[];
  days: PlanDay[];
}

export interface PlanInput {
  today: string;
  days: number;
  seed: number;
  festival: boolean;
  sevas: readonly SevaInfo[];
  lists: Lists;
  daysAhead: number;
  /** Past dates that already have a day close: never planned. */
  closedDates: ReadonlySet<string>;
  /** Whether today can still take receipts (its day is not closed). */
  todayOpen: boolean;
}

const FIRST_NAMES = [
  "Raghavendra", "Venkatesh", "Srinivas", "Lakshmi", "Padma", "Shreyas", "Anand", "Prasanna", "Gururaj", "Vadiraj",
  "Pramod", "Sudha", "Kavya", "Meghana", "Ananya", "Nagaraj", "Manjunath", "Ramesh", "Suresh", "Shobha",
  "Vijayalakshmi", "Bhagya", "Pavitra", "Harish", "Kiran", "Deepa", "Rekha", "Usha", "Jayanth", "Vasudev",
  "Krishnamurthy", "Narasimha", "Madhusudan", "Achyut", "Hemanth", "Sowmya", "Shruthi", "Arpitha", "Spoorthi",
  "Varun", "Prajwal", "Chaitra", "Nandini", "Aditi", "Rohit", "Vinay", "Sandeep", "Priya", "Neha", "Arjun",
  "Karthik", "Vikram", "Raghu", "Savitha", "Girish", "Jayashree", "Ashwini", "Mohan", "Seetha", "Gopal",
];
const SURNAMES = [
  "Rao", "Bhat", "Acharya", "Kulkarni", "Joshi", "Deshpande", "Upadhyaya", "Hegde", "Shastry", "Murthy", "Gowda",
  "Shetty", "Iyengar", "Aithal", "Karanth", "Adiga", "Holla", "Navada", "Kamath", "Pai", "Desai", "Patil", "Nayak",
  "Sharma", "Iyer", "Reddy",
];
const KANNADA_NAMES = [
  "ರಾಘವೇಂದ್ರ ರಾವ್", "ಲಕ್ಷ್ಮೀ ಭಟ್", "ವೆಂಕಟೇಶ ಆಚಾರ್ಯ", "ಪದ್ಮಾ ಕುಲಕರ್ಣಿ", "ಗುರುರಾಜ ಜೋಶಿ", "ಸುಧಾ ಹೆಗಡೆ",
  "ಮಂಜುನಾಥ ಗೌಡ", "ಶ್ರೀನಿವಾಸ ಮೂರ್ತಿ", "ಕಾವ್ಯ ಶೆಟ್ಟಿ", "ಅನಂತ ಪದ್ಮನಾಭ",
];
const CHANGE_UP_REASON = "Devotee offered more than the rate";
const CHANGE_DOWN_REASONS = ["Concession approved by the manager", "Senior citizen concession"];
const ANY_AMOUNTS_RUPEES = [101, 116, 151, 201, 251, 501, 1001];
const HOUR_WEIGHTS: ReadonlyArray<readonly [number, number]> = [
  [6, 2], [7, 6], [8, 8], [9, 7], [10, 5], [11, 4], [12, 3], [13, 2], [14, 1], [15, 1], [16, 2], [17, 5], [18, 7],
  [19, 6], [20, 3],
];

function weekdayOf(date: string): number {
  return istParts(istStartOfDay(date)).weekday;
}

class Planner {
  private readonly rng: Rng;
  private readonly regulars: PlanDevotee[] = [];
  private nextPhone = 0;
  private festivalDates: string[] = [];

  constructor(private readonly input: PlanInput) {
    this.rng = new Rng(input.seed);
    for (let i = 0; i < REGULARS; i += 1) this.regulars.push(this.newDevotee(true, true));
  }

  private phone(): string {
    const n = this.nextPhone % 10000;
    this.nextPhone += 1;
    return `${PHONE_PREFIX}${String(n).padStart(4, "0")}`;
  }

  private newDevotee(withPhone: boolean, detailed: boolean): PlanDevotee {
    const rng = this.rng;
    const { gotras, nakshatras, rashis } = this.input.lists;
    const name = rng.chance(0.1) ? rng.pick(KANNADA_NAMES) : `${rng.pick(FIRST_NAMES)} ${rng.pick(SURNAMES)}`;
    const has = (p: number, items: readonly ListItem[]): ListItem | null =>
      detailed && items.length > 0 && rng.chance(p) ? rng.pick(items) : null;
    const devotee: PlanDevotee = {
      name,
      gotra: has(0.85, gotras),
      nakshatra: has(0.7, nakshatras),
      rashi: has(0.4, rashis),
      phone: withPhone ? this.phone() : null,
    };
    if (detailed && !devotee.gotra && !devotee.nakshatra && !devotee.rashi && gotras.length > 0) {
      devotee.gotra = rng.pick(gotras);
    }
    return devotee;
  }

  private devotee(): PlanDevotee {
    if (this.rng.chance(SHARE_RETURNING)) return this.rng.pick(this.regulars);
    const withPhone = this.rng.chance(SHARE_NEW_WITH_PHONE);
    const devotee = this.newDevotee(withPhone, this.rng.chance(SHARE_NEW_WITH_DETAILS));
    if (withPhone) this.regulars.push(devotee);
    return devotee;
  }

  private seva(preferMultiDate: boolean, exclude: ReadonlySet<string>): SevaInfo {
    const pool = this.input.sevas.filter((s) => !exclude.has(s.id));
    const multi = pool.filter((s) => s.multiDate);
    const from = preferMultiDate && multi.length > 0 ? multi : pool;
    // Cheap sevas are booked far more often: weight 1/sqrt(rate in rupees); any-amount offerings are occasional.
    return this.rng.weighted(from, (s) => (s.ratePaise === null ? 0.05 : 1 / Math.sqrt(Math.max(s.ratePaise, 100) / 100)));
  }

  private changedRate(rate: number): { unit: number; reason: string } {
    const rng = this.rng;
    if (rate <= 5000 || rng.chance(0.5)) {
      return { unit: rate + rng.pick([1000, 2000, 5000, 10000]), reason: CHANGE_UP_REASON };
    }
    const off = Math.max(1000, Math.round((rate * rng.pick([0.1, 0.15, 0.2])) / 1000) * 1000);
    return { unit: rate - off, reason: rng.pick(CHANGE_DOWN_REASONS) };
  }

  private lines(multiDate: boolean): PlanLine[] {
    const rng = this.rng;
    const count = multiDate ? 1 : rng.chance(0.72) ? 1 : rng.chance(0.8) ? 2 : 3;
    const used = new Set<string>();
    const out: PlanLine[] = [];
    for (let i = 0; i < count && used.size < this.input.sevas.length; i += 1) {
      const seva = this.seva(multiDate, used);
      used.add(seva.id);
      const unit = seva.ratePaise ?? rng.pick(ANY_AMOUNTS_RUPEES) * 100;
      out.push({ sevaId: seva.id, quantity: rng.chance(0.9) ? 1 : rng.int(2, 3), ratePaise: seva.ratePaise, unitPaise: unit, changeReason: null });
    }
    if (rng.chance(SHARE_PRICE_CHANGE)) {
      const changeable = out.filter((l) => {
        const seva = this.input.sevas.find((s) => s.id === l.sevaId);
        return seva !== undefined && seva.ratePaise !== null && seva.allowChange;
      });
      if (changeable.length > 0) {
        const line = rng.pick(changeable);
        const change = this.changedRate(line.ratePaise as number);
        line.unitPaise = change.unit;
        line.changeReason = change.reason;
      }
    }
    return out;
  }

  /** Seva dates of one order issued on `date`, at most `room` of them, each date once. */
  private sevaDates(date: string, kind: DayKind, room: number, lastAllowed: string): string[] {
    const rng = this.rng;
    const festival = this.festivalDates;
    let dates: string[];
    const upcoming = festival.filter((d) => d > date && d <= addDays(date, 20));
    if (kind === "festival" && rng.chance(0.12)) {
      dates = festival.filter((d) => d >= date).slice(0, rng.int(2, 3));
    } else if (upcoming.length > 0 && rng.chance(0.08)) {
      dates = festival.filter((d) => d > date);
    } else if (rng.chance(0.05)) {
      dates = [addDays(date, rng.int(1, 30))];
    } else if (rng.chance(0.02)) {
      dates = [date, addDays(date, 7)];
    } else {
      dates = [date];
    }
    dates = dates.filter((d) => d <= lastAllowed);
    if (dates.length === 0) dates = [date];
    return dates.slice(0, Math.max(1, room));
  }

  private order(date: string, kind: DayKind, room: number, lastAllowed: string): PlanOrder {
    const rng = this.rng;
    const dates = this.sevaDates(date, kind, room, lastAllowed);
    const lines = this.lines(dates.length > 1);
    const receipts: PlanReceipt[] = dates.map((sevaDate) => {
      const own = lines.map((l) => ({ ...l }));
      const totalPaise = own.reduce((sum, l) => sum + l.quantity * l.unitPaise, 0);
      const share = sevaDate < this.input.today ? SHARE_PRASADAM_PAST : sevaDate === this.input.today ? SHARE_PRASADAM_TODAY : 0;
      return {
        clientReceiptId: randomUUID(),
        qrToken: newQrToken(),
        sevaDate,
        lines: own,
        totalPaise,
        changed: own.some((l) => l.ratePaise !== null && l.unitPaise !== l.ratePaise),
        givePrasadam: rng.chance(share),
        cancel: null,
      };
    });
    const total = receipts.reduce((sum, r) => sum + r.totalPaise, 0);
    const upi = rng.chance(SHARE_UPI);
    let cashReceived: number | null = null;
    if (!upi) {
      const roll = rng.next();
      if (roll < 0.35) cashReceived = total;
      else if (roll < 0.6) cashReceived = Math.ceil(total / (total > 50000 ? 50000 : 10000)) * (total > 50000 ? 50000 : 10000);
    }
    return {
      clientOrderId: randomUUID(),
      issuedAt: null,
      devotee: this.devotee(),
      payment: {
        mode: upi ? "upi" : "cash",
        cashReceivedPaise: cashReceived,
        upiRef: upi ? String(rng.int(0, 999999)).padStart(6, "0") : null,
      },
      receipts,
    };
  }

  private issueTimes(date: string, count: number): Date[] {
    const start = istStartOfDay(date).getTime();
    const times: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const [hour] = this.rng.weighted(HOUR_WEIGHTS, ([, w]) => w);
      times.push(start + ((hour * 60 + this.rng.int(0, 59)) * 60 + this.rng.int(0, 59)) * 1000);
    }
    return times.sort((a, b) => a - b).map((t) => new Date(t));
  }

  private day(date: string, kind: DayKind, today: boolean): PlanDay {
    const range = RECEIPT_RANGES[kind];
    const target = this.rng.int(range.min, range.max);
    const lastAllowed = addDays(this.input.today, today ? this.input.daysAhead : 365);
    const orders: PlanOrder[] = [];
    let receipts = 0;
    while (receipts < target) {
      const order = this.order(date, kind, target - receipts, lastAllowed);
      orders.push(order);
      receipts += order.receipts.length;
    }
    if (!today) {
      const times = this.issueTimes(date, orders.length);
      orders.forEach((o, i) => {
        o.issuedAt = times[i];
      });
    }
    return { date, kind, today, orders, close: today ? null : { differencePaise: 0, note: null } };
  }

  plan(): DemoPlan {
    const { today, days, festival, closedDates, todayOpen } = this.input;
    const history = Array.from({ length: days }, (_, i) => addDays(today, i - days));
    if (festival && days >= 3) {
      const end = addDays(today, -Math.max(1, Math.round(days * 0.45)));
      this.festivalDates = [addDays(end, -2), addDays(end, -1), end].filter((d) => d >= history[0]);
    }
    const skippedDates = history.filter((d) => closedDates.has(d));
    const planned: PlanDay[] = [];
    for (const date of history) {
      if (closedDates.has(date)) continue;
      const kind: DayKind = this.festivalDates.includes(date) ? "festival" : weekdayOf(date) === 7 ? "sunday" : "ordinary";
      planned.push(this.day(date, kind, false));
    }

    // Two past days (not festival days when there are others) close with a small difference and a note.
    const candidates = planned.filter((d) => d.kind !== "festival");
    const pool = candidates.length >= CLOSE_DIFFERENCES.length ? candidates : planned;
    const chosen = new Set<PlanDay>();
    while (chosen.size < Math.min(CLOSE_DIFFERENCES.length, pool.length)) chosen.add(this.rng.pick(pool));
    Array.from(chosen)
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((d, i) => {
        d.close = { differencePaise: CLOSE_DIFFERENCES[i].paise, note: CLOSE_DIFFERENCES[i].note };
      });

    if (todayOpen) {
      const todayDay = this.day(today, weekdayOf(today) === 7 ? "sunday" : "ordinary", true);
      // About 2% of today's receipts are cancelled (at least two): the first by its issuer inside the window, the
      // rest through the admin path. Cash only, so the drawer hands the money back and no refund is left due.
      const cash = todayDay.orders.filter((o) => o.payment.mode === "cash").map((o) => o.receipts[0]);
      const receiptsToday = todayDay.orders.reduce((n, o) => n + o.receipts.length, 0);
      const wanted = Math.min(cash.length, Math.max(2, Math.round(receiptsToday * SHARE_CANCEL_TODAY)));
      const reasons = [
        { reasonCode: "changed_mind", note: "Devotee asked to cancel before the seva" },
        { reasonCode: "wrong_devotee", note: null },
        { reasonCode: "other", note: "Booked for the wrong family member" },
      ];
      for (let i = 0; i < wanted; i += 1) {
        const receipt = cash[Math.floor((i * cash.length) / wanted)];
        receipt.givePrasadam = false;
        receipt.cancel =
          i === 0
            ? { byAdmin: false, reasonCode: "entered_twice", note: null }
            : { byAdmin: true, ...reasons[(i - 1) % reasons.length] };
      }
      planned.push(todayDay);
    }
    return { today, festivalDates: this.festivalDates, skippedDates, days: planned };
  }
}

/** The whole plan: pure, deterministic for a seed (apart from the ids and QR tokens). */
export function buildPlan(input: PlanInput): DemoPlan {
  if (input.sevas.length === 0) throw new DemoSeedError("No active counter seva to book. Add sevas first.");
  return new Planner(input).plan();
}

export interface DayCounts {
  date: string;
  kind: DayKind | "today";
  orders: number;
  receipts: number;
  multiDate: number;
  futureDated: number;
  changed: number;
  cash: number;
  upi: number;
  withPhone: number;
  prasadam: number;
  cancels: number;
  close: string;
}

export function dayCounts(day: PlanDay): DayCounts {
  const receipts = day.orders.flatMap((o) => o.receipts);
  const close = day.close === null ? "left open (today)" : day.close.differencePaise === 0 ? "balanced"
    : day.close.differencePaise < 0 ? `short Rs ${-day.close.differencePaise / 100}` : `extra Rs ${day.close.differencePaise / 100}`;
  return {
    date: day.date,
    kind: day.today ? "today" : day.kind,
    orders: day.orders.length,
    receipts: receipts.length,
    multiDate: day.orders.filter((o) => o.receipts.length > 1).reduce((n, o) => n + o.receipts.length, 0),
    futureDated: receipts.filter((r) => r.sevaDate > day.date).length,
    changed: receipts.filter((r) => r.changed).length,
    cash: day.orders.filter((o) => o.payment.mode === "cash").length,
    upi: day.orders.filter((o) => o.payment.mode === "upi").length,
    withPhone: day.orders.filter((o) => o.devotee.phone !== null).length,
    prasadam: receipts.filter((r) => r.givePrasadam).length,
    cancels: receipts.filter((r) => r.cancel !== null).length,
    close,
  };
}

function countsLine(c: DayCounts): string {
  return (
    `${c.date} ${c.kind.padEnd(8)} orders ${String(c.orders).padStart(3)}  receipts ${String(c.receipts).padStart(3)}` +
    `  multi-date ${String(c.multiDate).padStart(2)}  future ${String(c.futureDated).padStart(2)}` +
    `  changed ${c.changed}  cash/upi ${c.cash}/${c.upi}  phone ${c.withPhone}  prasadam ${c.prasadam}` +
    `  cancel ${c.cancels}  close ${c.close}`
  );
}

// =====================================================================================================================
// Running the plan through the seva SQL functions
// =====================================================================================================================

export interface RunOptions extends SeedOptions {
  /** The role of the issuing staff member as the routes read it from Firestore; 001 is the super admin. */
  issuerRole: "receptionist" | "temple_admin" | "super_admin";
  /** Parallel prasadam gives (each is its own transaction). */
  concurrency: number;
  log: (line: string) => void;
  now?: () => Date;
}

export interface SeedSummary {
  dryRun: boolean;
  today: string;
  festivalDates: string[];
  skippedDates: string[];
  days: DayCounts[];
  totals: {
    orders: number;
    receipts: number;
    offlineReceipts: number;
    onlineReceipts: number;
    prasadamGiven: number;
    cancelled: number;
    changed: number;
    dayCloses: number;
  };
}

interface Context {
  staffId: string;
  deviceId: string;
  onlineSeries: string;
  offlineSeries: string;
  sevas: SevaInfo[];
  lists: Lists;
  daysAhead: number;
  closedDates: Set<string>;
  todayOpen: boolean;
  festivalExists: boolean;
}

const MARKER_ENTITY = "demo_seed";
const FESTIVAL_NAME = "Aradhane (demo data)";

function str(row: Row, key: string): string {
  const v = row[key];
  return v === null || v === undefined ? "" : String(v);
}

function bool(row: Row, key: string): boolean {
  const v = row[key];
  return v === true || v === "t" || v === "true";
}

function asObject(value: unknown): Row {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}

function rupees(paise: number | null): string | null {
  return paise === null ? null : fromPaise(paise);
}

const COUNTER_OPEN_MS = 3 * 60 * 1000;
export const COUNTER_OPEN_MESSAGE =
  "The counter page is open on the PC. Close every counter tab, wait 3 minutes, then run again.";

/** A timestamptz as Supabase ('2026-10-19T04:30:00+00:00') or Postgres text ('2026-10-19 04:30:00.1+00') gives it. */
export function parseTimestamp(text: string): Date | null {
  if (text.trim() === "") return null;
  const iso = text.trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** What to do with the counter after a run that wrote OF numbers. */
export function counterAdvice(series: string, lastNo: number): string {
  return (
    `Before using the counter, open the counter page fresh while online. It will pick up ${series} last number ${lastNo}. ` +
    "Do not use Work offline in a tab that was open during seeding."
  );
}

async function loadContext(port: SeedPort, options: RunOptions, today: string): Promise<Context> {
  const staff = await port.select("staff", ["id", "staff_no", "status", "view_only"], { staff_no: options.staffNo });
  if (staff.length === 0 || str(staff[0], "status") !== "active" || bool(staff[0], "view_only")) {
    throw new DemoSeedError(`Staff no. ${options.staffNo} must exist, be active and not view-only. Nothing was changed.`);
  }

  const devices = (await port.select("counter_devices", ["id", "retired_at", "last_outbox_count", "last_seen_at"], { counter_id: options.counterId }))
    .filter((d) => d.retired_at === null || d.retired_at === undefined || d.retired_at === "");
  if (devices.length === 0) {
    throw new DemoSeedError(`Counter ${options.counterId} has no registered PC. Register this PC on the counter first.`);
  }
  // An open counter tab (above all one in Work offline, whose heartbeat stops) never learns the OF numbers written
  // here, so its next offline receipt would reuse a taken number. Every open tab heartbeats at least every minute.
  const seen = parseTimestamp(str(devices[0], "last_seen_at"));
  const now = (options.now ?? (() => new Date()))();
  if (!options.dryRun && seen !== null && now.getTime() - seen.getTime() < COUNTER_OPEN_MS) {
    throw new DemoSeedError(COUNTER_OPEN_MESSAGE);
  }
  if (Number(devices[0].last_outbox_count ?? 0) > 0) {
    throw new DemoSeedError(
      `The counter PC reports ${String(devices[0].last_outbox_count)} offline item(s) waiting to sync. ` +
        "Let it sync first, so its offline numbers never meet the demo ones. Nothing was changed.",
    );
  }

  const series = await port.select("receipt_series", ["code", "kind", "active"], { counter_id: options.counterId });
  const code = (kind: string): string => {
    const row = series.find((s) => str(s, "kind") === kind && bool(s, "active"));
    if (!row) throw new DemoSeedError(`Counter ${options.counterId} has no active ${kind} series.`);
    return str(row, "code");
  };

  const sevas = (await port.select("sevas", [
    "id", "code", "name", "amount", "any_amount", "allow_amount_change", "multi_date", "active", "visibility",
  ]))
    .filter((s) => bool(s, "active") && ["counter", "both"].includes(str(s, "visibility")))
    .map<SevaInfo>((s) => ({
      id: str(s, "id"),
      code: str(s, "code"),
      name: str(s, "name"),
      ratePaise: bool(s, "any_amount") ? null : toPaise(str(s, "amount")),
      allowChange: bool(s, "allow_amount_change"),
      multiDate: bool(s, "multi_date"),
    }))
    .filter((s) => s.ratePaise === null || s.ratePaise > 0);

  const items = await port.rpc("seva_list_items_get", {});
  const lists: Lists = { gotras: [], nakshatras: [], rashis: [] };
  for (const raw of Array.isArray(items) ? items : []) {
    const item = asObject(raw);
    const entry = { id: Number(item.item_id), name: str(item, "name_en") };
    if (item.active === false) continue;
    if (item.kind === "gotra" && entry.id >= 1) lists.gotras.push(entry);
    if (item.kind === "nakshatra") lists.nakshatras.push(entry);
    if (item.kind === "rashi") lists.rashis.push(entry);
  }

  const settings = await port.select("seva_settings", ["counter_days_ahead"], { id: 1 });
  const daysAhead = Math.min(30, Number(settings[0]?.counter_days_ahead ?? 365));

  const closes = await port.select("day_closes", ["business_date", "status"], { counter_id: options.counterId });
  const closedDates = new Set(closes.filter((c) => str(c, "status") === "closed").map((c) => str(c, "business_date").slice(0, 10)));
  // A reopened past day is left alone too: someone is working on it.
  const reopened = new Set(closes.filter((c) => str(c, "status") === "reopened").map((c) => str(c, "business_date").slice(0, 10)));
  reopened.forEach((d) => closedDates.add(d));

  const festivals = await port.select("festival_days", ["id", "name_en"], { name_en: FESTIVAL_NAME });

  return {
    staffId: str(staff[0], "id"),
    deviceId: str(devices[0], "id"),
    onlineSeries: code("counter_online"),
    offlineSeries: code("counter_offline"),
    sevas,
    lists,
    daysAhead,
    closedDates,
    todayOpen: !closedDates.has(today),
    festivalExists: festivals.length > 0,
  };
}

/** Runs fn over items with at most `limit` in flight; stops at the first failure. */
async function inPool<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** Denomination counts for an amount, largest first; whole rupees always end with Rs 1 coins. */
export function countCash(amountPaise: number, denominations: readonly { kind: "note" | "coin"; valuePaise: number }[]): {
  kind: "note" | "coin";
  value: number;
  count: number;
}[] {
  if (amountPaise < 0 || amountPaise % 100 !== 0) throw new DemoSeedError("A day's cash is not a whole number of rupees.");
  const sorted = [...denominations].sort((a, b) => b.valuePaise - a.valuePaise || (a.kind === "note" ? -1 : 1));
  let left = amountPaise;
  const counts = new Map<string, { kind: "note" | "coin"; value: number; count: number }>();
  for (const d of sorted) {
    const n = Math.floor(left / d.valuePaise);
    if (n > 0) {
      counts.set(`${d.kind}:${d.valuePaise}`, { kind: d.kind, value: d.valuePaise / 100, count: n });
      left -= n * d.valuePaise;
    }
  }
  if (left > 0) {
    const key = "coin:100";
    const existing = counts.get(key);
    counts.set(key, { kind: "coin", value: 1, count: (existing?.count ?? 0) + left / 100 });
  }
  return Array.from(counts.values());
}

class Runner {
  private readonly ofLast = new Map<number, number>();
  private readonly groupNext = new Map<string, number>();
  private readonly prasadam: { id: string }[] = [];
  readonly totals = { orders: 0, receipts: 0, offlineReceipts: 0, onlineReceipts: 0, prasadamGiven: 0, cancelled: 0, changed: 0, dayCloses: 0 };

  constructor(
    private readonly port: SeedPort,
    private readonly ctx: Context,
    private readonly options: RunOptions,
  ) {}

  private devotee(d: PlanDevotee): Row {
    return {
      name: d.name,
      gotra: d.gotra?.name ?? null,
      gotra_id: d.gotra?.id ?? null,
      nakshatra_id: d.nakshatra?.id ?? null,
      nakshatra_text: d.nakshatra?.name ?? null,
      rashi_id: d.rashi?.id ?? null,
      rashi_text: d.rashi?.name ?? null,
      phone_e164: d.phone,
    };
  }

  private payment(o: PlanOrder): Row {
    return o.payment.mode === "cash"
      ? { mode: "cash", cash_received: rupees(o.payment.cashReceivedPaise), upi_ref_last6: null, upi_seen_confirmed: null }
      : { mode: "upi", cash_received: null, upi_ref_last6: o.payment.upiRef, upi_seen_confirmed: true };
  }

  private line(l: PlanLine, offline: boolean): Row {
    const sendRate = l.ratePaise === null || l.unitPaise !== l.ratePaise;
    const out: Row = {
      seva_id: l.sevaId,
      quantity: l.quantity,
      unit_rate: sendRate ? fromPaise(l.unitPaise) : null,
      change_reason: l.changeReason,
    };
    if (offline) out.cached_rate = rupees(l.ratePaise);
    return out;
  }

  private async nextOfNumbers(year: number, count: number): Promise<number> {
    if (!this.ofLast.has(year)) {
      const rows = await this.port.select("receipt_series_years", ["last_no"], { series_code: this.ctx.offlineSeries, year });
      this.ofLast.set(year, Number(rows[0]?.last_no ?? 0));
    }
    const first = (this.ofLast.get(year) as number) + 1;
    this.ofLast.set(year, first + count - 1);
    return first;
  }

  private async groupNo(at: Date): Promise<string> {
    const p = istParts(at);
    const yymm = `${String(p.year % 100).padStart(2, "0")}${String(p.month).padStart(2, "0")}`;
    if (!this.groupNext.has(yymm)) {
      const floor = await this.port.rpc("seva_offline_group_floor", {
        p_counter_id: this.options.counterId,
        p_device_id: this.ctx.deviceId,
        p_at: at.toISOString(),
      });
      this.groupNext.set(yymm, Number(floor ?? 0) + 1);
    }
    const n = this.groupNext.get(yymm) as number;
    this.groupNext.set(yymm, n + 1);
    return formatOfflineGroupNo({ yymm, series: this.ctx.offlineSeries, n });
  }

  private collect(day: PlanDay, order: PlanOrder, answer: unknown): Row[] {
    const receipts = asObject(answer).receipts;
    const rows = Array.isArray(receipts) ? receipts.map(asObject) : [];
    // duplicate: true is a retried call whose first try had already been stored: its stored rows are used. They must
    // be this order's own receipts, all of them.
    const ids = new Set(rows.map((r) => str(r, "client_receipt_id")));
    if (rows.length !== order.receipts.length || !order.receipts.every((r) => ids.has(r.clientReceiptId))) {
      throw new DemoSeedError(`An order of ${day.date} came back with ${rows.length} other receipts.`);
    }
    for (const row of rows) {
      const planned = order.receipts.find((r) => r.clientReceiptId === str(row, "client_receipt_id"));
      if (planned?.givePrasadam && str(row, "prasadam") === "pending") this.prasadam.push({ id: str(row, "id") });
    }
    this.totals.orders += 1;
    this.totals.receipts += rows.length;
    this.totals.changed += order.receipts.filter((r) => r.changed).length;
    return rows;
  }

  async syncPastOrder(day: PlanDay, order: PlanOrder): Promise<void> {
    const at = order.issuedAt as Date;
    const p = istParts(at);
    const sorted = [...order.receipts].sort((a, b) => a.sevaDate.localeCompare(b.sevaDate));
    const first = await this.nextOfNumbers(p.year, sorted.length);
    const receipts = sorted.map((r, i) => ({
      client_receipt_id: r.clientReceiptId,
      seva_date: r.sevaDate,
      qr_token: r.qrToken,
      running_no: first + i,
      receipt_no: formatReceiptNo({
        series: this.ctx.offlineSeries, staffNo: this.options.staffNo, channel: null, month: p.month, year: p.year, running: first + i,
      }),
      lines: r.lines.map((l) => this.line(l, true)),
    }));
    const answer = await this.port.rpc("seva_sync_offline_order", {
      p_order: {
        client_order_id: order.clientOrderId,
        supersedes_client_order_id: null,
        expected_total: fromPaise(order.receipts.reduce((s, r) => s + r.totalPaise, 0)),
        devotee: this.devotee(order.devotee),
        payment: this.payment(order),
        issuer_staff_no: String(this.options.staffNo),
        issued_at: at.toISOString(),
        group_no: await this.groupNo(at),
        receipts,
      },
      p_staff_id: this.ctx.staffId,
      p_device_id: this.ctx.deviceId,
      p_issuer_role: this.options.issuerRole,
    });
    this.totals.offlineReceipts += this.collect(day, order, answer).length;
  }

  async closeDay(day: PlanDay): Promise<string> {
    const close = day.close as { differencePaise: number; note: string | null };
    const prep = asObject(await this.port.rpc("seva_prepare_day_close", { p_counter_id: this.options.counterId, p_business_date: day.date }));
    if (str(prep, "status") === "closed") return "already closed";
    const denominations = (Array.isArray(prep.denominations) ? prep.denominations : []).map(asObject).map((d) => ({
      kind: (str(d, "kind") === "coin" ? "coin" : "note") as "note" | "coin",
      valuePaise: toPaise(str(d, "value")),
    }));
    const counted = toPaise(str(prep, "cash_expected")) + close.differencePaise;
    try {
      await this.port.rpc("seva_close_day", {
        p_counter_id: this.options.counterId,
        p_business_date: day.date,
        p_counts: countCash(Math.max(0, counted), denominations),
        p_upi_bank_total: str(prep, "upi_expected"),
        p_note: close.note,
        p_staff_id: this.ctx.staffId,
        // M-2 needs the live counter PC seen in the last 2 minutes, and the seeder runs only when it was NOT seen for
        // 3 (FINAL-FIX N-6): every close uses the admin override with its reason, audited on the dayclose.close row.
        // The seeder already refused a PC with offline items waiting, so the override hides nothing.
        p_counter_offline_ok: true,
        p_counter_offline_reason: DEMO_CLOSE_REASON,
      });
    } catch (error) {
      if (error instanceof SeedRpcError && error.code === "day_already_closed") return "already closed";
      throw error;
    }
    this.totals.dayCloses += 1;
    return dayCounts(day).close;
  }

  async issueToday(day: PlanDay): Promise<void> {
    const cancels: { id: string; cancel: NonNullable<PlanReceipt["cancel"]> }[] = [];
    for (const order of day.orders) {
      const answer = await this.port.rpc("seva_issue_counter_order", {
        p_order: {
          client_order_id: order.clientOrderId,
          supersedes_client_order_id: null,
          expected_total: fromPaise(order.receipts.reduce((s, r) => s + r.totalPaise, 0)),
          devotee: this.devotee(order.devotee),
          payment: this.payment(order),
          receipts: order.receipts.map((r) => ({
            client_receipt_id: r.clientReceiptId,
            seva_date: r.sevaDate,
            qr_token: r.qrToken,
            lines: r.lines.map((l) => this.line(l, false)),
          })),
        },
        p_staff_id: this.ctx.staffId,
        p_device_id: this.ctx.deviceId,
      });
      const rows = this.collect(day, order, answer);
      this.totals.onlineReceipts += rows.length;
      await this.port.rpc("seva_record_prints", {
        p_receipt_ids: rows.map((r) => str(r, "id")),
        p_staff_id: this.ctx.staffId,
        p_device_id: this.ctx.deviceId,
      });
      for (const row of rows) {
        const planned = order.receipts.find((r) => r.clientReceiptId === str(row, "client_receipt_id"));
        if (planned?.cancel) cancels.push({ id: str(row, "id"), cancel: planned.cancel });
      }
    }
    for (const c of cancels) {
      try {
        await this.port.rpc("seva_cancel_receipts", {
          p_receipt_ids: [c.id],
          p_reason_code: c.cancel.reasonCode,
          p_note: c.cancel.note,
          p_staff_id: this.ctx.staffId,
          p_is_admin: c.cancel.byAdmin,
        });
      } catch (error) {
        // A retried cancel whose first try was stored.
        if (!(error instanceof SeedRpcError && error.code === "already_cancelled")) throw error;
      }
      this.totals.cancelled += 1;
    }
  }

  async givePrasadam(): Promise<void> {
    await inPool(this.prasadam, this.options.concurrency, async ({ id }) => {
      const answer = asObject(await this.port.rpc("seva_mark_prasadam", { p_receipt_id: id, p_staff_id: this.ctx.staffId, p_confirm_off_date: true }));
      if (answer.state === "given" || answer.state === "already_given") this.totals.prasadamGiven += 1;
    });
  }
}

/**
 * Reads the project, plans the demo data and, unless dryRun, writes it through the seva SQL functions. Throws
 * DemoSeedError (a refusal, nothing written unless it says otherwise) or SeedRpcError (a function refused part-way).
 */
export async function runDemoSeed(port: SeedPort, options: RunOptions): Promise<SeedSummary> {
  const now = options.now ?? (() => new Date());
  const today = businessDate(now());
  const firstDate = addDays(today, -options.days);
  if (Number(firstDate.slice(0, 4)) < 2026) {
    throw new DemoSeedError(`--days ${options.days} reaches back to ${firstDate}; receipt numbers start in 2026. Use fewer days.`);
  }

  const markers = await port.select("audit_log", ["id", "action"], { entity: MARKER_ENTITY });
  if (markers.length > 0 && !options.again) {
    throw new DemoSeedError(
      "Demo data was already seeded into this project (audit trail: demo.seed_started). Add --again to add more; " +
        "days that already have a day close are never touched. Nothing was changed.",
    );
  }

  const ctx = await loadContext(port, options, today);
  const plan = buildPlan({
    today,
    days: options.days,
    seed: options.seed,
    festival: options.festival && !ctx.festivalExists,
    sevas: ctx.sevas,
    lists: ctx.lists,
    daysAhead: ctx.daysAhead,
    closedDates: ctx.closedDates,
    todayOpen: ctx.todayOpen,
  });
  const counts = plan.days.map(dayCounts);
  const log = options.log;
  log(`Today (IST): ${today}. ${options.dryRun ? "Dry run - nothing will be written." : "Seeding."}`);
  if (plan.festivalDates.length > 0) log(`Aradhane festival days: ${plan.festivalDates.join(", ")}`);
  if (plan.skippedDates.length > 0) log(`Left alone (already closed): ${plan.skippedDates.join(", ")}`);
  if (!ctx.todayOpen) log("Today is already closed on this counter: no receipts for today.");
  counts.forEach((c) => log(countsLine(c)));
  const planned = counts.reduce((n, c) => n + c.receipts, 0);
  log(`Planned: ${counts.reduce((n, c) => n + c.orders, 0)} orders, ${planned} receipts, ${counts.reduce((n, c) => n + c.prasadam, 0)} prasadam gives.`);

  const summaryOf = (runner: Runner | null): SeedSummary => ({
    dryRun: options.dryRun,
    today,
    festivalDates: plan.festivalDates,
    skippedDates: plan.skippedDates,
    days: counts,
    totals: runner?.totals ?? { orders: 0, receipts: 0, offlineReceipts: 0, onlineReceipts: 0, prasadamGiven: 0, cancelled: 0, changed: 0, dayCloses: 0 },
  });
  if (options.dryRun) return summaryOf(null);

  const runner = new Runner(port, ctx, options);
  let stage: { date: string | null; what: string } = { date: null, what: "writing the start marker" };
  try {
    await writeAll(port, options, ctx, plan, runner, firstDate, planned, (next) => {
      stage = next;
    });
  } catch (error) {
    log(stopAdvice(stage, today));
    throw error;
  } finally {
    const rows = await port
      .select("receipt_series_years", ["last_no"], { series_code: ctx.offlineSeries, year: istParts(now()).year })
      .catch(() => []);
    log(counterAdvice(ctx.offlineSeries, Number(rows[0]?.last_no ?? 0)));
  }
  return summaryOf(runner);
}

/** What to tell the owner when a run stops part-way. */
export function stopAdvice(stage: { date: string | null; what: string }, today: string): string {
  const where = stage.date ? `${stage.date} (${stage.what})` : stage.what;
  const lines = [`Stopped while working on ${where}. Everything stored before this point stays; days with a day close are complete.`];
  if (stage.date && stage.date !== today) {
    lines.push(
      `${stage.date} has some of its receipts and no day close yet. Either close it on the Close day page and run ` +
        "again with --again (closed days are skipped), or run again with --again straight away, which adds a full day " +
        `of receipts to ${stage.date} on top of what it has.`,
    );
  } else {
    lines.push(
      "The past days are done. Running again with --again adds a new set of receipts for today; for the prasadam " +
        "that was not given yet, use the Prasadam page.",
    );
  }
  return lines.join("\n");
}

async function writeAll(
  port: SeedPort,
  options: RunOptions,
  ctx: Context,
  plan: DemoPlan,
  runner: Runner,
  firstDate: string,
  planned: number,
  setStage: (stage: { date: string | null; what: string }) => void,
): Promise<void> {
  const log = options.log;
  const today = plan.today;
  await port.rpc("seva_audit", {
    p_action: "demo.seed_started",
    p_entity: MARKER_ENTITY,
    p_entity_id: null,
    p_receipt_no: null,
    p_reason: "Demo data for a test project, written by scripts/seva/seed-demo-data.ts",
    p_before: null,
    p_after: { days: options.days, seed: options.seed, from: firstDate, to: today, planned_receipts: planned },
    p_staff_id: null,
  });

  if (plan.festivalDates.length > 0) {
    setStage({ date: null, what: "saving the Aradhane festival days" });
    await port.rpc("seva_save_festival", {
      p_festival: { name_en: FESTIVAL_NAME, name_kn: "ಆರಾಧನೆ", active: true, days: plan.festivalDates },
      p_staff_id: ctx.staffId,
    });
  }

  const started = Date.now();
  for (const day of plan.days) {
    if (day.today) continue;
    setStage({ date: day.date, what: "syncing its receipts" });
    for (const order of day.orders) await runner.syncPastOrder(day, order);
    setStage({ date: day.date, what: "closing the day" });
    const closed = await runner.closeDay(day);
    log(`${day.date}: ${day.orders.reduce((n, o) => n + o.receipts.length, 0)} receipts synced, day close ${closed} (${Math.round((Date.now() - started) / 1000)} s)`);
  }
  const todayDay = plan.days.find((d) => d.today);
  if (todayDay) {
    setStage({ date: today, what: "issuing today's receipts" });
    await runner.issueToday(todayDay);
    log(`${today}: ${todayDay.orders.reduce((n, o) => n + o.receipts.length, 0)} receipts issued online, ${runner.totals.cancelled} cancelled`);
  }
  setStage({ date: today, what: "giving prasadam" });
  await runner.givePrasadam();
  log(`Prasadam given on ${runner.totals.prasadamGiven} receipts.`);

  setStage({ date: null, what: "writing the finish marker" });
  await port.rpc("seva_audit", {
    p_action: "demo.seed_finished",
    p_entity: MARKER_ENTITY,
    p_entity_id: null,
    p_receipt_no: null,
    p_reason: "Demo data for a test project, written by scripts/seva/seed-demo-data.ts",
    p_before: null,
    p_after: { ...runner.totals, seconds: Math.round((Date.now() - started) / 1000) },
    p_staff_id: null,
  });
}

// =====================================================================================================================
// Wiring to Supabase (only when run as a script)
// =====================================================================================================================

const BUSINESS_ERROR = /^SEVA:([a-z_]+)$/;
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const PAGE = 1000;

/** The reason on the close-day override every seeded day close uses (FINAL-FIX N-6). */
export const DEMO_CLOSE_REASON = "Demo data seeding";

/**
 * Calls that are safe to send again after a failure whose reply was lost: a repeat of a stored one answers
 * duplicate: true (orders), already_given (prasadam), day_already_closed (close) or already_cancelled (cancel), which
 * the seeder takes as success, or only reads. Prints (a repeat is a DUPLICATE reprint), the festival (a second one)
 * and the audit markers are sent once.
 */
export const RETRYABLE = new Set([
  "seva_sync_offline_order",
  "seva_issue_counter_order",
  "seva_mark_prasadam",
  "seva_close_day",
  "seva_cancel_receipts",
  "seva_prepare_day_close",
  "seva_offline_group_floor",
  "seva_list_items_get",
]);

export interface RawRpcResult {
  data: unknown;
  error: { message?: unknown; details?: unknown; code?: unknown } | null;
}

/**
 * The rpc of the Supabase port: a SEVA business refusal becomes SeedRpcError at once; a database or network failure
 * is tried up to 3 times for a RETRYABLE call, else once. Failures are named by code only (database text can hold
 * personal data).
 */
export function retryingRpc(
  raw: (fn: string, args: Record<string, unknown>) => Promise<RawRpcResult>,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): SeedPort["rpc"] {
  return async (fn, args) => {
    if (!/^seva_[a-z0-9_]+$/.test(fn)) throw new DemoSeedError(`Only seva_* functions are called (${fn}).`);
    const attempts = RETRYABLE.has(fn) ? 3 : 1;
    let lastError: SeedRpcError | null = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      let result: RawRpcResult;
      try {
        result = await raw(fn, args);
      } catch (error) {
        result = { data: null, error: { code: error instanceof Error ? error.name : "network" } };
      }
      if (!result.error) return result.data;
      const match = BUSINESS_ERROR.exec(String(result.error.message ?? "").trim());
      if (match) throw new SeedRpcError(fn, match[1], typeof result.error.details === "string" ? result.error.details : "");
      lastError = new SeedRpcError(fn, `database code ${String(result.error.code ?? "unknown")}`, "");
      if (attempt < attempts) await sleep(1000 * attempt);
    }
    throw lastError as SeedRpcError;
  };
}

async function supabasePort(url: string, key: string): Promise<SeedPort> {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const port: SeedPort = {
      rpc: retryingRpc(async (fn, args) => {
        const { data, error } = await db.rpc(fn, args);
        return { data, error };
      }),
      async select(table, columns, filters = {}) {
        if (!IDENTIFIER.test(table) || !columns.every((c) => IDENTIFIER.test(c))) throw new DemoSeedError("Bad table or column name.");
        const rows: Row[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await db.from(table).select(columns.join(",")).match(filters).range(from, from + PAGE - 1);
          if (error) throw new SeedRpcError(`read ${table}`, `database code ${String(error.code ?? "unknown")}`, "");
          const page = (data ?? []) as unknown as Row[];
          rows.push(...page);
          if (page.length < PAGE) return rows;
        }
      },
  };
  return port;
}

async function main(argv: readonly string[]): Promise<number> {
  const dotenv = await import("dotenv");
  for (const file of [".env.local", ".env"]) dotenv.config({ path: path.resolve(process.cwd(), file), quiet: true });
  const guard = checkGuards(argv, process.env);
  if (guard.kind === "help") {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const port = await supabasePort(guard.url, guard.key);
  await runDemoSeed(port, {
    ...guard.options,
    issuerRole: "super_admin",
    concurrency: 6,
    log: (line) => process.stdout.write(`${line}\n`),
  });
  process.stdout.write(guard.options.dryRun ? "Dry run finished. Nothing was written.\n" : "Demo data seeded.\n");
  return 0;
}

if (typeof require !== "undefined" && require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      const text =
        error instanceof DemoSeedError || error instanceof SeedRpcError
          ? error.message
          : `Stopped by an unexpected ${error instanceof Error ? error.name : "error"}.`;
      process.stderr.write(`${text}\n`);
      process.exitCode = 1;
    },
  );
}
