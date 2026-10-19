/**
 * The counter repository (DB §6.5, §8, §9): what the counter routes - me, bootstrap, orders, sync, prints, heartbeat -
 * read and call. Writes go through the A2 SQL functions (callRpc); reads use the service-role client. The wire format
 * is camelCase with integer paise; the SQL JSON contract is snake_case with rupee strings ('820.00'), so this file
 * converts both ways and adds the Kannada names of the devotee pick lists to what the counter prints.
 *
 * Offline work (DB §8.3): the person signed in when the outbox is sent is only the syncer. The person who made an
 * offline order or cancel is named by the staff no. the item carries; their role is read the way the guard reads any
 * role (staff row -> sign-in uid -> access profile -> mapFirestoreRole) and passed to SQL, which decides acceptance.
 */

import "server-only";
import { z } from "zod";
import { GOTRAS } from "@/lib/seva/domain/gotras";
import { findListOption, slipNameLists, type CounterPickLists } from "@/lib/seva/domain/lists";
import { NAKSHATRAS } from "@/lib/seva/domain/nakshatras";
import { RASHIS } from "@/lib/seva/domain/rashis";
import { SevaError, type SevaErrorCode } from "@/lib/seva/errors";
import { fromPaise, toPaise } from "@/lib/seva/money";
import { DEFAULT_PAPER_SIZE, isPaperSize } from "@/lib/seva/print/paper";
import type { HeartbeatAnswer } from "@/lib/seva/offline/heartbeat";
import { can, mapFirestoreRole, SEVA_ACTIONS, type PermissionContext, type SevaActor } from "@/lib/seva/permissions";
import { businessDate, istParts } from "@/lib/seva/time";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CatalogueSeva,
  CounterBootstrap,
  CounterOrderPayload,
  IssuedLine,
  IssuedReceipt,
  IssueResponse,
  OfflineOrderPayload,
  OutboxItem,
  SevaMe,
  SevaLists,
  SevaRole,
  SlipSettings,
  SyncResponse,
} from "@/types/seva";
import type { VerifiedDevice } from "./device";
import { readCounterUpi } from "./finance";
import { getIdentityAdapter } from "./identity";
import { readListsOrNone } from "./lists";
import { callRpc } from "./rpc";

type Json = Record<string, unknown>;
type SyncResult = SyncResponse["results"][number];

// =====================================================================================================================
// Request bodies
// =====================================================================================================================

/**
 * The JSON body and its zod check, under the names the counter routes import. One implementation, in read.ts: a body
 * that is not JSON, and the schema's first issue, are SevaError('validation') naming the field.
 */
export { parseInput as parseBody, readJson as readJsonBody } from "./read";

/**
 * The guard's verified PC; a route that asked for `device: 'required'` always has one, so null fails closed. It is
 * marked `retired` only on the sync route, the one route that allows a retired PC.
 */
export function liveDevice(device: VerifiedDevice | null): VerifiedDevice {
  if (!device) throw new SevaError("device_required");
  return device;
}

/** `counter/prints`: the receipts that just came out of the printer (seva_record_prints takes 1 to 31). */
export const printsRequestSchema = z.object({ receiptIds: z.array(z.guid()).min(1).max(31) });

/** `counter/heartbeat` (DB §8.3): outbox size, this PC's clock skew and the counter app version. */
export const heartbeatRequestSchema = z.object({
  outboxCount: z.number().int().min(0).max(1_000_000),
  clockSkewMs: z.number().int().min(-2_147_483_648).max(2_147_483_647),
  appVersion: z.string().trim().max(40),
});

// =====================================================================================================================
// Reading SQL and table answers (anything unexpected is SevaError('internal'))
// =====================================================================================================================

function bad(): never {
  throw new SevaError("internal");
}

function isJson(value: unknown): value is Json {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function obj(value: unknown): Json {
  return isJson(value) ? value : bad();
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : bad();
}

function str(value: unknown): string {
  return typeof value === "string" ? value : bad();
}

function strOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return str(value);
}

function int(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : bad();
}

function intOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return int(value);
}

function bool(value: unknown): boolean {
  return typeof value === "boolean" ? value : bad();
}

/** A numeric value from SQL ('505.00', or a JSON number from PostgREST) as integer paise. */
function paise(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") bad();
  try {
    return toPaise(value);
  } catch {
    return bad();
  }
}

/** A timestamptz from SQL ('2026-10-18T10:42:00+05:30') as an ISO string in UTC. */
function isoTime(value: unknown): string {
  const ms = Date.parse(str(value));
  return Number.isNaN(ms) ? bad() : new Date(ms).toISOString();
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : bad();
}

/** Rows of a Supabase select; a database error is SevaError('internal') (its text is never logged or returned). */
function rows(result: { data: unknown; error: unknown }): Json[] {
  if (result.error) bad();
  return result.data === null ? [] : list(result.data).map(obj);
}

function row(result: { data: unknown; error: unknown }): Json | null {
  if (result.error) bad();
  return result.data === null || result.data === undefined ? null : obj(result.data);
}

/** The counter of a receipt read with `seva_orders!inner(counter_id)` (an object, or a one-element list). */
function orderCounterId(value: unknown): number | null {
  const order = Array.isArray(value) ? value[0] : value;
  return intOrNull(obj(order).counter_id);
}

// =====================================================================================================================
// Wire payload -> SQL JSON contract
// =====================================================================================================================

function sqlDevotee(d: CounterOrderPayload["devotee"]): Json {
  return {
    name: d.name,
    gotra: d.gotra?.text ?? null,
    gotra_id: d.gotra?.id ?? null,
    nakshatra_id: d.nakshatra?.id ?? null,
    nakshatra_text: d.nakshatra?.text ?? null,
    rashi_id: d.rashi?.id ?? null,
    rashi_text: d.rashi?.text ?? null,
    phone_e164: d.phone ?? null,
  };
}

function sqlPayment(p: CounterOrderPayload["payment"]): Json {
  return {
    mode: p.mode,
    cash_received: p.cashReceivedPaise === undefined ? null : fromPaise(p.cashReceivedPaise),
    upi_ref_last6: p.upiRefLast6 ?? null,
    upi_seen_confirmed: p.upiSeenConfirmed ?? null,
  };
}

function sqlLine(l: CounterOrderPayload["receipts"][number]["lines"][number]): Json {
  return {
    seva_id: l.sevaId,
    quantity: l.quantity,
    // null = the catalogue rate; a rate is sent only when changed or for an any-amount seva.
    unit_rate: l.unitRatePaise === undefined ? null : fromPaise(l.unitRatePaise),
    change_reason: l.changeReason ?? null,
  };
}

/** The p_order of seva_issue_counter_order: snake_case, money as rupee strings. */
export function toSqlOrder(p: CounterOrderPayload): Record<string, unknown> {
  return {
    client_order_id: p.clientOrderId,
    supersedes_client_order_id: p.supersedesClientOrderId ?? null,
    expected_total: fromPaise(p.expectedTotalPaise),
    devotee: sqlDevotee(p.devotee),
    payment: sqlPayment(p.payment),
    receipts: p.receipts.map((r) => ({
      client_receipt_id: r.clientReceiptId,
      seva_date: r.sevaDate,
      qr_token: r.qrToken,
      lines: r.lines.map(sqlLine),
    })),
  };
}

/** The p_order of seva_sync_offline_order: the issue contract plus who, when, the group label, numbers and cached rates. */
export function toSqlOfflineOrder(p: OfflineOrderPayload): Record<string, unknown> {
  return {
    client_order_id: p.clientOrderId,
    supersedes_client_order_id: p.supersedesClientOrderId ?? null,
    expected_total: fromPaise(p.expectedTotalPaise),
    devotee: sqlDevotee(p.devotee),
    payment: sqlPayment(p.payment),
    issuer_staff_no: p.issuerStaffNo,
    issued_at: p.issuedAt,
    group_no: p.groupNo,
    receipts: p.receipts.map((r) => ({
      client_receipt_id: r.clientReceiptId,
      seva_date: r.sevaDate,
      qr_token: r.qrToken,
      running_no: r.runningNo,
      receipt_no: r.receiptNo,
      lines: r.lines.map((l) => ({
        ...sqlLine(l),
        cached_rate: l.cachedRatePaise === null ? null : fromPaise(l.cachedRatePaise),
      })),
    })),
  };
}

// =====================================================================================================================
// SQL answer -> wire
// =====================================================================================================================

function issuedLine(value: unknown): IssuedLine {
  const l = obj(value);
  return {
    lineNo: int(l.line_no),
    sevaId: str(l.seva_id),
    code: strOrNull(l.code),
    nameEn: str(l.name_en),
    nameKn: strOrNull(l.name_kn),
    quantity: int(l.quantity),
    unitRatePaise: paise(l.unit_rate),
    amountPaise: paise(l.amount),
    changed: bool(l.changed),
    prasadamItems: strOrNull(l.prasadam_items),
  };
}

/**
 * The devotee as the slip prints it: list picks in English with the Kannada name, free text as typed. No phone.
 * Names come from the lists temple admins keep (A4P-5), hidden gotras included, else from the built-in lists.
 */
function issuedDevotee(value: unknown, names: CounterPickLists): IssuedReceipt["devotee"] {
  const d = obj(value);
  const out: IssuedReceipt["devotee"] = { name: str(d.name) };

  const gotraText = strOrNull(d.gotra);
  const gotra = findListOption(names.gotras, GOTRAS, intOrNull(d.gotra_id));
  const gotraName = gotraText ?? gotra?.en;
  if (gotraName) out.gotra = gotraName;
  if (gotra?.kn) out.gotraKn = gotra.kn;

  const nakshatra = findListOption(names.nakshatras, NAKSHATRAS, intOrNull(d.nakshatra_id));
  const nakshatraText = strOrNull(d.nakshatra_text);
  if (nakshatra) {
    out.nakshatra = nakshatra.en;
    if (nakshatra.kn) out.nakshatraKn = nakshatra.kn;
  } else if (nakshatraText) {
    out.nakshatra = nakshatraText;
  }

  const rashi = findListOption(names.rashis, RASHIS, intOrNull(d.rashi_id));
  const rashiText = strOrNull(d.rashi_text);
  if (rashi) {
    out.rashi = rashi.en;
    if (rashi.kn) out.rashiKn = rashi.kn;
  } else if (rashiText) {
    out.rashi = rashiText;
  }
  return out;
}

function issuedReceipt(value: unknown, names: CounterPickLists): IssuedReceipt {
  const r = obj(value);
  const payment = obj(r.payment);
  const issuedBy = obj(r.issued_by);
  const mode = oneOf(payment.mode, ["cash", "upi", "online"] as const);
  const upiRef = strOrNull(payment.upi_ref_last6);
  return {
    id: strOrNull(r.id),
    clientReceiptId: str(r.client_receipt_id),
    receiptNo: str(r.receipt_no),
    seriesCode: str(r.series_code),
    sevaDate: str(r.seva_date),
    groupNo: str(r.group_no),
    position: int(r.position),
    count: int(r.count),
    orderTotalPaise: paise(r.order_total),
    totalPaise: paise(r.total),
    lines: list(r.lines).map(issuedLine),
    payment: mode === "upi" && upiRef ? { mode, upiRefLast6: upiRef } : { mode },
    devotee: issuedDevotee(r.devotee, names),
    qrToken: str(r.qr_token),
    issuedAt: isoTime(r.issued_at),
    issuedBy: { name: str(issuedBy.name), staffNo: intOrNull(issuedBy.staff_no) },
    counterName: strOrNull(r.counter_name),
    channel: oneOf(r.channel, ["counter", "web", "app"] as const),
    issuedOffline: bool(r.issued_offline),
    status: oneOf(r.status, ["issued", "cancelled"] as const),
    printCount: int(r.print_count),
    prasadam: oneOf(r.prasadam, ["none", "pending", "given"] as const),
  };
}

/**
 * seva_order_json's answer as the IssueResponse wire type: numerics to paise, Kannada list names added. `lists` are
 * the lists temple admins keep (readListsOrNone); without them the built-in names are printed.
 */
export function fromSqlIssue(answer: unknown, lists?: SevaLists | null): IssueResponse {
  const o = obj(answer);
  const names = slipNameLists(lists);
  return {
    orderId: str(o.order_id),
    groupNo: str(o.group_no),
    duplicate: bool(o.duplicate),
    receipts: list(o.receipts).map((receipt) => issuedReceipt(receipt, names)),
  };
}

/** seva_heartbeat's answer as the counter's HeartbeatAnswer. */
export function fromSqlHeartbeat(answer: unknown): HeartbeatAnswer {
  const h = obj(answer);
  return {
    serverTime: isoTime(h.server_time),
    ofSeries: str(h.of_series),
    lastOfNo: int(h.last_of_no),
    lastOfGroupNo: int(h.last_of_group_no),
    dayClosed: bool(h.day_closed),
  };
}

/** seva_record_prints's answer: each receipt's print count and whether this print was a duplicate. */
export function fromSqlPrints(answer: unknown): { receipts: { id: string; printCount: number; duplicate: boolean }[] } {
  return {
    receipts: list(obj(answer).receipts).map((value) => {
      const r = obj(value);
      return { id: str(r.id), printCount: int(r.print_count), duplicate: bool(r.duplicate) };
    }),
  };
}

// =====================================================================================================================
// Counter, me and bootstrap
// =====================================================================================================================

/** The counter a registered PC belongs to, with its online (C<n>) and offline (OF<n>) series. */
export async function loadCounterInfo(counterId: number): Promise<CounterBootstrap["counter"]> {
  const db = createAdminClient();
  const [counterRead, seriesRead] = await Promise.all([
    db.from("counters").select("id, name").eq("id", counterId).maybeSingle(),
    db.from("receipt_series").select("code, kind").eq("counter_id", counterId),
  ]);
  const counter = row(counterRead) ?? bad();
  const series = rows(seriesRead);
  const code = (kind: string): string => str(series.find((s) => s.kind === kind)?.code);
  return { id: int(counter.id), name: str(counter.name), onlineSeries: code("counter_online"), offlineSeries: code("counter_offline") };
}

/** Stands for "someone else" when listing what a person may do in the best case (staff.change_role needs another person). */
const ANOTHER_STAFF_MEMBER = "another-staff-member";

/**
 * GET me: who is signed in, what they may do and the counter of a live device. The first call of an invited person
 * marks them active (seva_mark_signed_in). `actions` lists each action the person may do in its best case - on this
 * PC's own counter, today, their own receipt inside the window, a person below super admin - so the browser can show
 * or hide it; the server checks every real call against the record's own facts.
 */
export async function loadSevaMe(actor: SevaActor, device: { id: string; counterId: number } | null): Promise<SevaMe> {
  const [staffRead, counter] = await Promise.all([
    createAdminClient().from("staff").select("status").eq("id", actor.staffId).maybeSingle(),
    device ? loadCounterInfo(device.counterId) : Promise.resolve(null),
  ]);
  const staff = row(staffRead) ?? bad();
  if (staff.status === "invited") await callRpc<unknown>("seva_mark_signed_in", { p_staff_id: actor.staffId });

  const today = businessDate(new Date());
  const bestCase: PermissionContext = {
    counterIdOfDevice: device?.counterId,
    receiptCounterId: device?.counterId,
    todayBusinessDate: today,
    receiptBusinessDate: today,
    receiptIssuedByStaffId: actor.staffId,
    withinCancelWindow: true,
    targetStaffId: ANOTHER_STAFF_MEMBER,
    targetRole: "receptionist",
    newRole: "receptionist",
  };
  return {
    staffId: actor.staffId,
    staffNo: actor.staffNo,
    name: actor.name,
    role: actor.role,
    viewOnly: actor.viewOnly,
    actions: SEVA_ACTIONS.filter((action) => can(actor, action, bestCase)),
    counter,
  };
}

function catalogueSeva(s: Json): CatalogueSeva {
  const anyAmount = bool(s.any_amount);
  return {
    id: str(s.id),
    code: strOrNull(s.code),
    key: int(s.display_order),
    nameEn: str(s.name),
    nameKn: strOrNull(s.name_kn),
    // Any-amount sevas (Other Seva / Karnike) are stored with amount 0 and told by the flag, never by the amount.
    ratePaise: anyAmount ? null : paise(s.amount),
    multiDate: bool(s.multi_date),
    allowAmountChange: bool(s.allow_amount_change),
    prasadamGiven: bool(s.prasadam_given),
    prasadamItems: strOrNull(s.prasadam_items),
    visibility: oneOf(s.visibility, ["counter", "online", "both"] as const),
    active: bool(s.active),
    category: str(s.category),
    incomeLedger: strOrNull(s.income_ledger),
  };
}

function slipSettings(s: Json): SlipSettings {
  return {
    templeNameEn: str(s.temple_name_en),
    templeNameKn: str(s.temple_name_kn),
    addressLine1: str(s.address_line1),
    addressLine2: str(s.address_line2),
    registrationLine: strOrNull(s.registration_line),
    photoLeftUrl: strOrNull(s.photo_left_url),
    photoRightUrl: strOrNull(s.photo_right_url),
    footerLine1: str(s.footer_line1),
    footerLine2: str(s.footer_line2),
    footerBlessing: str(s.footer_blessing),
    printGotra: bool(s.print_gotra),
    printNakshatra: bool(s.print_nakshatra),
    printRashi: bool(s.print_rashi),
    // Receipt paper (plan A4S-7); an unknown or missing value prints on A5.
    paperSize: isPaperSize(s.paper_size) ? s.paper_size : DEFAULT_PAPER_SIZE,
    paperCustomWidthMm: typeof s.paper_custom_w_mm === "number" ? s.paper_custom_w_mm : null,
    paperCustomHeightMm: typeof s.paper_custom_h_mm === "number" ? s.paper_custom_h_mm : null,
  };
}

/** Festival chips (DB §9.3): active festivals whose last date is today or later, with their dates from today on. */
function festivalChips(festivals: Json[], today: string): CounterBootstrap["festivalChips"] {
  return festivals.flatMap((f) => {
    const dates = list(f.festival_day_dates)
      .map((d) => str(obj(d).day))
      .filter((day) => day >= today)
      .sort();
    return dates.length === 0 ? [] : [{ name: str(f.name_en), nameKn: strOrNull(f.name_kn), dates }];
  });
}

/**
 * GET counter/bootstrap: everything the counter page needs to issue online and to keep working offline - the counter,
 * the counter catalogue in key order, slip settings, rules, cash denominations, festival chips, next numbers, the OF
 * number floor and the group label floor (seva_offline_group_floor at `serverTime`, so the counter keys it by the IST
 * month of `serverTime`, as it keys the heartbeat's), today's totals, UPI, the site address for QR links, and the
 * gotra, nakshatra and rashi lists temple admins keep (A4P-5). The lists are left out when they cannot be read - the
 * counter then offers its built-in lists - so a lists problem never stops the counter from issuing.
 */
export async function loadBootstrap(
  actor: SevaActor,
  device: { id: string; counterId: number },
  opts: { origin?: string } = {},
): Promise<CounterBootstrap> {
  void actor; // The guard has already checked the person; nothing here depends on who it is.
  const now = new Date();
  const serverTime = now.toISOString();
  const today = businessDate(now);
  const year = istParts(now).year;
  const db = createAdminClient();

  const [counter, sevasRead, settingsRead, festivalsRead, yearsRead, prepAnswer, groupFloor, upi, lists] = await Promise.all([
    loadCounterInfo(device.counterId),
    db
      .from("sevas")
      .select(
        "id, code, name, name_kn, amount, any_amount, multi_date, allow_amount_change, prasadam_given, prasadam_items, visibility, active, category, income_ledger, display_order",
      )
      .eq("active", true)
      .in("visibility", ["counter", "both"])
      .order("display_order", { ascending: true }),
    db
      .from("seva_settings")
      .select(
        "temple_name_en, temple_name_kn, address_line1, address_line2, registration_line, photo_left_url, photo_right_url, footer_line1, footer_line2, footer_blessing, print_gotra, print_nakshatra, print_rashi, paper_size, paper_custom_w_mm, paper_custom_h_mm, cancel_window_minutes, amount_change_reason_required, counter_days_ahead, cash_difference_note_required",
      )
      .eq("id", 1)
      .maybeSingle(),
    db.from("festival_days").select("name_en, name_kn, festival_day_dates(day)").eq("active", true),
    db.from("receipt_series_years").select("series_code, last_no").eq("year", year),
    callRpc<unknown>("seva_prepare_day_close", { p_counter_id: device.counterId, p_business_date: today }),
    callRpc<unknown>("seva_offline_group_floor", { p_counter_id: device.counterId, p_device_id: device.id, p_at: serverTime }),
    readCounterUpi(),
    readListsOrNone(),
  ]);

  const settings = row(settingsRead) ?? bad();
  const lastNo = (series: string): number => {
    const found = rows(yearsRead).find((y) => y.series_code === series);
    return found ? int(found.last_no) : 0;
  };
  const prep = obj(prepAnswer);
  const lastOfNo = lastNo(counter.offlineSeries);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || opts.origin || "").replace(/\/+$/, "");

  return {
    counter,
    catalogue: rows(sevasRead)
      .map(catalogueSeva)
      .sort((a, b) => a.key - b.key || a.nameEn.localeCompare(b.nameEn)),
    slip: slipSettings(settings),
    rules: {
      cancelWindowMinutes: int(settings.cancel_window_minutes),
      amountChangeReasonRequired: bool(settings.amount_change_reason_required),
      counterDaysAhead: int(settings.counter_days_ahead),
      cashDifferenceNoteRequired: bool(settings.cash_difference_note_required),
    },
    denominations: list(prep.denominations).map((value) => {
      const d = obj(value);
      return { kind: oneOf(d.kind, ["note", "coin"] as const), valuePaise: paise(d.value) };
    }),
    festivalChips: festivalChips(rows(festivalsRead), today),
    nextNumbers: [counter.onlineSeries, counter.offlineSeries].map((series) => ({ series, nextRunningNo: lastNo(series) + 1 })),
    lastOfNo,
    lastOfGroupNo: int(groupFloor),
    today: {
      businessDate: today,
      receipts: int(prep.receipts),
      // cash_expected includes the counter's opening float; the strip shows what was taken today.
      cashPaise: paise(prep.cash_expected) - paise(prep.opening_float),
      upiPaise: paise(prep.upi_expected),
      dayClosed: prep.status === "closed",
    },
    upi,
    upiDisabledReason: upi ? null : "not_configured",
    serverTime,
    siteUrl,
    ...(lists ? { lists } : {}),
  };
}

// =====================================================================================================================
// Prints
// =====================================================================================================================

/** The receipts about to be printed: how often each was printed, its business date and its counter (null = online). */
export async function readPrintTargets(
  receiptIds: string[],
): Promise<{ id: string; printCount: number; businessDate: string; counterId: number | null }[]> {
  const result = await createAdminClient()
    .from("seva_receipts")
    .select("id, print_count, business_date, seva_orders!inner(counter_id)")
    .in("id", [...new Set(receiptIds)]);
  return rows(result).map((r) => ({
    id: str(r.id),
    printCount: int(r.print_count),
    businessDate: str(r.business_date),
    counterId: orderCounterId(r.seva_orders),
  }));
}

// =====================================================================================================================
// Offline sync (DB §8.3, §9.11)
// =====================================================================================================================

/**
 * The seva role of the person an outbox item names by staff no. (an offline order's issuer, an offline cancel's
 * canceller): staff row -> sign-in uid -> access profile -> mapFirestoreRole. null when there is no staff row, no
 * profile or no seva role, and when the profile says inactive while the staff row still says active - the two stores
 * disagree, and drift may only deny (DB §3.2). Someone offboarded since (staff row inactive and profile inactive) keeps
 * the role they had, so SQL can accept their earlier work and audit it. The SQL function decides acceptance.
 */
async function readOfflineRole(staffNo: number): Promise<SevaRole | null> {
  const staff = row(
    await createAdminClient().from("staff").select("firebase_uid, status").eq("staff_no", staffNo).maybeSingle(),
  );
  if (!staff) return null;
  const uid = str(staff.firebase_uid);
  const status = str(staff.status);
  const profile = await getIdentityAdapter().getAccessProfile(uid);
  if (!profile) return null;
  const role = mapFirestoreRole(profile.role);
  if (!role) return null;
  if (profile.isActive !== true && status === "active") return null;
  return role;
}

/** One lookup per staff no. within a sync call. */
function offlineRoleLookup(): (staffNo: number) => Promise<SevaRole | null> {
  const cache = new Map<number, Promise<SevaRole | null>>();
  return (staffNo) => {
    let role = cache.get(staffNo);
    if (!role) {
      role = readOfflineRole(staffNo);
      cache.set(staffNo, role);
    }
    return role;
  };
}

/**
 * The receipts an offline cancel names, by client receipt id. Every one must exist (not_found) and belong to the
 * syncing PC's counter (forbidden): offline, a PC only ever cancels its own counter's receipts. Receipts already
 * cancelled are left out; an empty list means nothing is left to do.
 */
async function resolveOfflineCancel(
  clientReceiptIds: string[],
  counterId: number,
): Promise<{ refused: SevaErrorCode } | { liveIds: string[] }> {
  const wanted = [...new Set(clientReceiptIds)];
  const result = await createAdminClient()
    .from("seva_receipts")
    .select("id, client_receipt_id, status, seva_orders!inner(counter_id)")
    .in("client_receipt_id", wanted);
  const byClientId = new Map(rows(result).map((r) => [str(r.client_receipt_id), r]));
  const found = wanted.map((clientId) => byClientId.get(clientId));
  if (found.some((r) => r === undefined)) return { refused: "not_found" };
  const receipts = found as Json[];
  if (receipts.some((r) => orderCounterId(r.seva_orders) !== counterId)) return { refused: "forbidden" };
  return { liveIds: receipts.filter((r) => r.status === "issued").map((r) => str(r.id)) };
}

async function syncItem(
  item: OutboxItem,
  actor: SevaActor,
  device: VerifiedDevice,
  roleOf: (staffNo: number) => Promise<SevaRole | null>,
): Promise<SyncResult> {
  if (item.kind === "order") {
    const role = await roleOf(item.payload.issuerStaffNo);
    const answer = await callRpc<unknown>("seva_sync_offline_order", {
      p_order: toSqlOfflineOrder(item.payload),
      p_staff_id: actor.staffId,
      p_device_id: device.id,
      p_issuer_role: role,
    });
    return { seq: item.seq, ok: true, duplicate: obj(answer).duplicate === true };
  }

  // A retired PC's late uploads are taken only inside its replaced range (DB 8.4), which only an order's numbers can
  // show; a cancel from it is refused (A3 security gate L-4).
  if (device.retired) return { seq: item.seq, ok: false, code: "device_unknown" };
  const resolved = await resolveOfflineCancel(item.clientReceiptIds, device.counterId);
  if ("refused" in resolved) return { seq: item.seq, ok: false, code: resolved.refused };
  if (resolved.liveIds.length === 0) return { seq: item.seq, ok: true, duplicate: true };
  const role = await roleOf(item.cancelledByStaffNo);
  const answer = await callRpc<unknown>("seva_cancel_receipts", {
    p_receipt_ids: resolved.liveIds,
    p_reason_code: item.reasonCode,
    p_note: item.note ?? null,
    p_staff_id: actor.staffId,
    p_is_admin: false,
    p_at: item.at,
    p_cancelled_by_staff_no: item.cancelledByStaffNo,
    p_canceller_role: role,
    // A5-FIX L-4: the PC the cancel was made on, recorded in the audit row.
    p_device_id: device.id,
  });
  const inClosedDay = list(obj(answer).receipts).some((r) => obj(r).in_closed_day === true);
  return inClosedDay ? { seq: item.seq, ok: true, inClosedDay: true } : { seq: item.seq, ok: true };
}

/**
 * POST counter/sync: stores outbox items in `seq` order - orders through seva_sync_offline_order, cancels through
 * seva_cancel_receipts with the time they were made. A business refusal answers that item with its code and the rest
 * go on; any other failure stops at that item and is returned as `failure` (the route answers 503), with the results
 * of the items before it. From a retired PC only orders are taken, and SQL holds them to its device_replaced gap.
 */
export async function syncOutbox(
  actor: SevaActor,
  device: VerifiedDevice,
  items: OutboxItem[],
): Promise<{ results: SyncResult[]; failure: unknown }> {
  const roleOf = offlineRoleLookup();
  const results: SyncResult[] = [];
  for (const item of [...items].sort((a, b) => a.seq - b.seq)) {
    try {
      results.push(await syncItem(item, actor, device, roleOf));
    } catch (error) {
      if (error instanceof SevaError && error.code !== "internal") {
        results.push({ seq: item.seq, ok: false, code: error.code });
        continue;
      }
      return { results, failure: error };
    }
  }
  return { results, failure: null };
}
