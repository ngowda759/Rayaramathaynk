/**
 * An in-memory stand-in for every Phase 1 route of Design Book 6.5 (`/api/seva/**`), for the seva browser tests.
 *
 * `install(page)` routes each `/api/seva/**` request of the page to `handle()`; unit tests call `handle()` directly.
 * The semantics are deliberately simple: sequential numbers per series, an idempotent `clientOrderId`, cancel within
 * the window, prints, prasadam states, day close, and fixtures for reports, settings and staff. Errors use the real
 * wire shape `{ error: { code, message } }` with the code's HTTP status from `lib/seva/errors.ts`.
 *
 * The caller's role comes from `req.role`, or in the browser from the e-mail inside the emulator ID token sent as
 * `Authorization: Bearer <token>` (see `fixtures/auth.ts`). UI tasks add or override routes with `extend()`, in their
 * own files; an extended handler runs before the role checks and answers 200 with what it returns, `fakeResponse()`
 * for another status, or throws `FakeApiError`.
 */
import type { Page } from "@playwright/test";
import type {
  CancelReasonCode,
  CatalogueSeva,
  CounterBootstrap,
  CounterLineInput,
  CounterOrderPayload,
  DevoteeInput,
  IssuedLine,
  IssuedReceipt,
  IssueResponse,
  OfflineOrderPayload,
  OutboxItem,
  SevaAction,
  SevaMe,
  SyncResponse,
} from "../../../../types/seva";
import { isSevaErrorCode, sevaErrorMessage, sevaErrorStatus } from "../../../../lib/seva/errors";
import { formatGroupNo, formatReceiptNo, parseLookupInput, parseReceiptNo } from "../../../../lib/seva/numbering";
import { newQrToken } from "../../../../lib/seva/qr";
import { businessDate, istParts } from "../../../../lib/seva/time";
import { GOTRAS } from "../../../../lib/seva/domain/gotras";
import { NAKSHATRAS } from "../../../../lib/seva/domain/nakshatras";
import { RASHIS } from "../../../../lib/seva/domain/rashis";
import { findOption } from "../../../../lib/seva/domain/options";
import { roleFromEmail, type E2ERole } from "./auth";
import {
  E2E_COUNTER,
  E2E_SITE_URL,
  defaultCatalogue,
  defaultDashboard,
  defaultMe,
  defaultReports,
  defaultSettings,
  defaultStaff,
  type E2ESettings,
} from "./data";

// ---------------------------------------------------------------------------------------------------------------
// Public contract (plan Task A2-12)
// ---------------------------------------------------------------------------------------------------------------

export interface FakeState {
  catalogue: CatalogueSeva[];
  receipts: IssuedReceipt[];
  /** Last running number per series code ('C1', 'OF1', ...). */
  lastNo: Record<string, number>;
  me: Record<E2ERole, SevaMe>;
  /** `GET reports/dashboard` answer. */
  dashboard: unknown;
  /** Settings by section (`GET/PUT settings/<section>`); the default is an `E2ESettings` object. */
  settings: unknown;
  staff: unknown[];
  dayClosed: boolean;
}

export interface FakeRequest {
  method: string;
  /** Path with its query string, as the page sent it: '/api/seva/receipts?status=issued'. */
  path: string;
  body: unknown;
}

export type FakeFailure = "timeout" | "network" | { status: number; code: string };

export type FakeResult =
  | { kind: "json"; status: number; body: unknown }
  | { kind: "abort"; reason: "timedout" | "failed" };

export type FakeHandler = (req: FakeRequest) => unknown;

export interface FakeSevaApi {
  state: FakeState;
  requests: FakeRequest[];
  install(page: Page): Promise<void>;
  /** The next call whose route starts with `pathPrefix` ('counter/orders' or '/api/seva/counter/orders') fails once. */
  failNext(pathPrefix: string, kind: FakeFailure): void;
  /** Fixes the fake's clock; until called, the fake uses the real time. */
  setNow(iso: string): void;
  /** Keys are 'METHOD route' or 'route'; a ':name' or '*' segment matches any one segment ('GET receipts/:id'). */
  extend(handlers: Record<string, FakeHandler>): void;
  /** The fake's request handler, for unit tests (no browser). */
  handle(req: FakeRequest & { role?: E2ERole | null }): Promise<FakeResult>;
}

/** Thrown by an extended handler to answer with a seva error. */
export class FakeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "FakeApiError";
  }
}

/** Returned by an extended handler to answer with a status other than 200. */
export class FakeReply {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {}
}

export function fakeResponse(status: number, body: unknown): FakeReply {
  return new FakeReply(status, body);
}

// ---------------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------------

const API_PREFIX = "/api/seva/";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isWholeNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function routeOf(path: string): string {
  const pathname = path.split("?")[0];
  const trimmed = pathname.startsWith(API_PREFIX) ? pathname.slice(API_PREFIX.length) : pathname.replace(/^\/+/, "");
  return trimmed.replace(/\/+$/, "");
}

function queryOf(path: string): URLSearchParams {
  const at = path.indexOf("?");
  return new URLSearchParams(at === -1 ? "" : path.slice(at + 1));
}

/** Matches 'receipts/:id/reissue' against 'receipts/abc/reissue'; returns the named segments or null. */
function matchPattern(pattern: string, route: string): Record<string, string> | null {
  const want = pattern.split("/");
  const have = route.split("/");
  if (want.length !== have.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i += 1) {
    if (want[i] === "*") continue;
    if (want[i].startsWith(":")) {
      params[want[i].slice(1)] = decodeURIComponent(have[i]);
      continue;
    }
    if (want[i] !== have[i]) return null;
  }
  return params;
}

function seriesOf(receiptNo: string): string {
  return receiptNo.split("-")[0];
}

function dayDiff(a: string, b: string): number {
  const toUtc = (d: string): number => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** Reads the e-mail out of a Firebase emulator ID token (an unsigned JWT); null when there is none. */
export function roleFromAuthorization(header: string | null | undefined): E2ERole | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  const parts = header.slice("Bearer ".length).trim().split(".");
  if (parts.length < 2) return null;
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return isRecord(payload) && typeof payload.email === "string" ? roleFromEmail(payload.email) : null;
  } catch {
    return null;
  }
}

class Refusal extends Error {
  constructor(
    public readonly code: string,
    public readonly detail?: Record<string, unknown>,
    public readonly status?: number,
  ) {
    super(code);
  }
}

function errorBody(code: string, detail?: Record<string, unknown>): { error: { code: string; message: string } } {
  const message = isSevaErrorCode(code) ? sevaErrorMessage(code, detail) : "Something went wrong.";
  return { error: { code, message } };
}

function errorResult(code: string, detail?: Record<string, unknown>, status?: number): FakeResult {
  const httpStatus = status ?? (isSevaErrorCode(code) ? sevaErrorStatus(code) : 500);
  return { kind: "json", status: httpStatus, body: errorBody(code, detail) };
}

// ---------------------------------------------------------------------------------------------------------------
// Fake
// ---------------------------------------------------------------------------------------------------------------

interface ReceiptExtra {
  devotee: DevoteeInput;
  counterId: number;
  issuedByStaffId: string | null;
  history: { at: string; action: string; by: string | null; reason: string | null }[];
  cancel: { at: string; by: string; reasonCode: CancelReasonCode; note: string | null } | null;
  given: { at: string; by: string; byStaffId: string } | null;
}

interface Ctx {
  method: string;
  route: string;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  me: SevaMe;
}

interface BuiltIn {
  method: string;
  pattern: string;
  action: SevaAction;
  run: (ctx: Ctx) => unknown;
}

export function createFakeSevaApi(seed: Partial<FakeState> = {}): FakeSevaApi {
  const state: FakeState = {
    catalogue: seed.catalogue ?? defaultCatalogue(),
    receipts: seed.receipts ?? [],
    lastNo: seed.lastNo ?? {},
    me: seed.me ?? defaultMe(),
    dashboard: seed.dashboard ?? defaultDashboard(),
    settings: seed.settings ?? defaultSettings(),
    staff: seed.staff ?? defaultStaff(),
    dayClosed: seed.dayClosed ?? false,
  };
  const requests: FakeRequest[] = [];
  const failures: { prefix: string; kind: FakeFailure }[] = [];
  const extensions: { method: string | null; pattern: string; handler: FakeHandler }[] = [];
  const orders = new Map<string, IssueResponse>();
  const extras = new Map<string, ReceiptExtra>();
  const reports = defaultReports();
  let fixedNow: string | null = null;
  let seq = 0;

  const now = (): Date => (fixedNow ? new Date(fixedNow) : new Date());
  const today = (): string => businessDate(now());
  const nextId = (kind: string): string => `fake-${kind}-${++seq}`;

  function settings(): Record<string, unknown> {
    if (!isRecord(state.settings)) state.settings = {};
    return state.settings as Record<string, unknown>;
  }

  function setting<K extends keyof E2ESettings>(key: K): E2ESettings[K] {
    const value = settings()[key];
    return (value === undefined ? defaultSettings()[key] : value) as E2ESettings[K];
  }

  function counterOf(me: SevaMe): CounterBootstrap["counter"] {
    return me.counter ?? E2E_COUNTER;
  }

  function findReceipt(idOrClientId: string): IssuedReceipt | undefined {
    return state.receipts.find((r) => r.id === idOrClientId || r.clientReceiptId === idOrClientId);
  }

  function extraOf(r: IssuedReceipt): ReceiptExtra {
    let extra = extras.get(r.clientReceiptId);
    if (!extra) {
      extra = { devotee: { name: r.devotee.name }, counterId: E2E_COUNTER.id, issuedByStaffId: null, history: [], cancel: null, given: null };
      extras.set(r.clientReceiptId, extra);
    }
    return extra;
  }

  function nextRunning(series: string): number {
    const n = (state.lastNo[series] ?? 0) + 1;
    state.lastNo[series] = n;
    return n;
  }

  function devoteeOut(d: DevoteeInput): IssuedReceipt["devotee"] {
    const out: IssuedReceipt["devotee"] = { name: d.name.trim() };
    const gotra = findOption(GOTRAS, d.gotra?.id);
    if (gotra) {
      out.gotra = gotra.en;
      out.gotraKn = gotra.kn;
    } else if (d.gotra?.text) {
      out.gotra = d.gotra.text.trim();
    }
    const nakshatra = findOption(NAKSHATRAS, d.nakshatra?.id);
    if (nakshatra) {
      out.nakshatra = nakshatra.en;
      out.nakshatraKn = nakshatra.kn;
    } else if (d.nakshatra?.text) {
      out.nakshatra = d.nakshatra.text.trim();
    }
    const rashi = findOption(RASHIS, d.rashi?.id);
    if (rashi) {
      out.rashi = rashi.en;
      out.rashiKn = rashi.kn;
    } else if (d.rashi?.text) {
      out.rashi = d.rashi.text.trim();
    }
    return out;
  }

  function priceLine(line: CounterLineInput, lineNo: number, opts: { offline: boolean; cachedRatePaise?: number | null }): IssuedLine {
    const seva = state.catalogue.find((s) => s.id === line.sevaId);
    if (!seva) throw new Refusal("validation");
    let unit: number;
    if (opts.offline) {
      unit = line.unitRatePaise ?? opts.cachedRatePaise ?? seva.ratePaise ?? 0;
    } else {
      if (!seva.active) throw new Refusal("seva_inactive", { name: seva.nameEn });
      if (seva.visibility === "online") throw new Refusal("seva_not_on_counter", { name: seva.nameEn });
      if (line.unitRatePaise === undefined) {
        if (seva.ratePaise === null) throw new Refusal("validation");
        unit = seva.ratePaise;
      } else {
        if (!isWholeNumber(line.unitRatePaise, 0, Number.MAX_SAFE_INTEGER)) throw new Refusal("validation");
        unit = line.unitRatePaise;
        if (seva.ratePaise !== null && unit !== seva.ratePaise) {
          if (!seva.allowAmountChange) throw new Refusal("amount_change_not_allowed", { name: seva.nameEn });
          if (setting("rules").amountChangeReasonRequired && (line.changeReason ?? "").trim().length < 3) {
            throw new Refusal("change_reason_required");
          }
        }
      }
    }
    return {
      lineNo,
      sevaId: seva.id,
      code: seva.code,
      nameEn: seva.nameEn,
      nameKn: seva.nameKn,
      quantity: line.quantity,
      unitRatePaise: unit,
      amountPaise: unit * line.quantity,
      changed: seva.ratePaise !== null && unit !== seva.ratePaise,
      prasadamItems: seva.prasadamItems,
    };
  }

  function prasadamOf(lines: IssuedLine[]): IssuedReceipt["prasadam"] {
    return lines.some((l) => state.catalogue.find((s) => s.id === l.sevaId)?.prasadamGiven) ? "pending" : "none";
  }

  function groupNoNow(): string {
    const p = istParts(now());
    const yymm = `${String(p.year % 100).padStart(2, "0")}${String(p.month).padStart(2, "0")}`;
    return formatGroupNo({ yymm, n: orders.size + 1 });
  }

  function validOrderShape(body: unknown): body is CounterOrderPayload {
    if (!isRecord(body) || !isString(body.clientOrderId) || !isRecord(body.devotee) || !isRecord(body.payment)) return false;
    if (typeof body.devotee.name !== "string" || body.devotee.name.trim().length < 1 || body.devotee.name.trim().length > 80) return false;
    if (!isWholeNumber(body.expectedTotalPaise, 0, Number.MAX_SAFE_INTEGER)) return false;
    if (!Array.isArray(body.receipts) || body.receipts.length < 1 || body.receipts.length > 31) return false;
    return body.receipts.every(
      (r: unknown) =>
        isRecord(r) &&
        isString(r.clientReceiptId) &&
        isString(r.sevaDate) &&
        isString(r.qrToken) &&
        Array.isArray(r.lines) &&
        r.lines.length >= 1 &&
        r.lines.length <= 8 &&
        r.lines.every((l: unknown) => isRecord(l) && isString(l.sevaId) && isWholeNumber(l.quantity, 1, 99)),
    );
  }

  function currentReceipts(response: IssueResponse): IssuedReceipt[] {
    return response.receipts.map((r) => findReceipt(r.clientReceiptId) ?? r);
  }

  function issueOrder(body: unknown, me: SevaMe): IssueResponse {
    if (!validOrderShape(body)) throw new Refusal("validation");
    const known = orders.get(body.clientOrderId);
    if (known) return { ...known, duplicate: true, receipts: currentReceipts(known) };
    if (state.dayClosed) throw new Refusal("day_closed");

    const todayDate = today();
    const maxAhead = setting("rules").counterDaysAhead;
    const priced = body.receipts.map((r) => {
      const ahead = dayDiff(todayDate, r.sevaDate);
      if (Number.isNaN(ahead) || ahead < 0 || ahead > maxAhead) throw new Refusal("date_out_of_range");
      const lines = r.lines.map((l, i) => priceLine(l, i + 1, { offline: false }));
      return { input: r, lines, total: lines.reduce((sum, l) => sum + l.amountPaise, 0) };
    });
    const orderTotal = priced.reduce((sum, r) => sum + r.total, 0);
    if (orderTotal !== body.expectedTotalPaise) {
      throw new Refusal("price_changed", { lines: priced.flatMap((r) => r.lines.map((l) => ({ sevaId: l.sevaId, ratePaise: l.unitRatePaise }))) });
    }
    if (body.payment.mode === "cash" && body.payment.cashReceivedPaise !== undefined && body.payment.cashReceivedPaise < orderTotal) {
      throw new Refusal("cash_short");
    }
    if (body.payment.mode === "upi" && (!/^[0-9]{6}$/.test(body.payment.upiRefLast6 ?? "") || body.payment.upiSeenConfirmed !== true)) {
      throw new Refusal("upi_details_required");
    }

    const counter = counterOf(me);
    const issuedAt = now().toISOString();
    const p = istParts(now());
    const groupNo = groupNoNow();
    const receipts = priced.map((r, i): IssuedReceipt => {
      const running = nextRunning(counter.onlineSeries);
      const receipt: IssuedReceipt = {
        id: nextId("receipt"),
        clientReceiptId: r.input.clientReceiptId,
        receiptNo: formatReceiptNo({ series: counter.onlineSeries, staffNo: me.staffNo, channel: null, month: p.month, year: p.year, running }),
        seriesCode: counter.onlineSeries,
        sevaDate: r.input.sevaDate,
        groupNo,
        position: i + 1,
        count: priced.length,
        orderTotalPaise: orderTotal,
        totalPaise: r.total,
        lines: r.lines,
        payment: body.payment.mode === "upi" ? { mode: "upi", upiRefLast6: body.payment.upiRefLast6 } : { mode: "cash" },
        devotee: devoteeOut(body.devotee),
        qrToken: r.input.qrToken,
        issuedAt,
        issuedBy: { name: me.name, staffNo: me.staffNo },
        counterName: counter.name,
        channel: "counter",
        issuedOffline: false,
        status: "issued",
        printCount: 0,
        prasadam: prasadamOf(r.lines),
      };
      extras.set(receipt.clientReceiptId, {
        devotee: body.devotee,
        counterId: counter.id,
        issuedByStaffId: me.staffId,
        history: [{ at: issuedAt, action: "issued", by: me.name, reason: null }],
        cancel: null,
        given: null,
      });
      return receipt;
    });
    state.receipts.push(...receipts);
    const response: IssueResponse = { orderId: nextId("order"), groupNo, duplicate: false, receipts };
    orders.set(body.clientOrderId, response);
    return response;
  }

  function syncOrder(payload: OfflineOrderPayload, me: SevaMe): { ok: boolean; duplicate?: boolean; code?: string } {
    if (orders.has(payload.clientOrderId)) return { ok: true, duplicate: true };
    const taken = payload.receipts.find((r) => state.receipts.some((x) => x.receiptNo === r.receiptNo));
    if (taken) return { ok: false, code: "number_conflict" };
    const counter = counterOf(me);
    const priced = payload.receipts.map((r) => {
      const lines = r.lines.map((l, i) => priceLine(l, i + 1, { offline: true, cachedRatePaise: l.cachedRatePaise }));
      return { input: r, lines, total: lines.reduce((sum, l) => sum + l.amountPaise, 0) };
    });
    const orderTotal = priced.reduce((sum, r) => sum + r.total, 0);
    const receipts = priced.map((r, i): IssuedReceipt => {
      const series = seriesOf(r.input.receiptNo);
      state.lastNo[series] = Math.max(state.lastNo[series] ?? 0, r.input.runningNo);
      const receipt: IssuedReceipt = {
        id: nextId("receipt"),
        clientReceiptId: r.input.clientReceiptId,
        receiptNo: r.input.receiptNo,
        seriesCode: series,
        sevaDate: r.input.sevaDate,
        groupNo: payload.groupNo,
        position: i + 1,
        count: priced.length,
        orderTotalPaise: orderTotal,
        totalPaise: r.total,
        lines: r.lines,
        payment: payload.payment.mode === "upi" ? { mode: "upi", upiRefLast6: payload.payment.upiRefLast6 } : { mode: "cash" },
        devotee: devoteeOut(payload.devotee),
        qrToken: r.input.qrToken,
        issuedAt: payload.issuedAt,
        issuedBy: { name: me.name, staffNo: me.staffNo },
        counterName: counter.name,
        channel: "counter",
        issuedOffline: true,
        status: "issued",
        printCount: 1,
        prasadam: prasadamOf(r.lines),
      };
      extras.set(receipt.clientReceiptId, {
        devotee: payload.devotee,
        counterId: counter.id,
        issuedByStaffId: me.staffId,
        history: [{ at: payload.issuedAt, action: "issued_offline", by: me.name, reason: null }],
        cancel: null,
        given: null,
      });
      return receipt;
    });
    state.receipts.push(...receipts);
    orders.set(payload.clientOrderId, { orderId: nextId("order"), groupNo: payload.groupNo, duplicate: false, receipts });
    return { ok: true, duplicate: false };
  }

  function cancelReceipts(receipts: IssuedReceipt[], me: SevaMe, reasonCode: CancelReasonCode, note: string | null, at: string): void {
    for (const r of receipts) {
      r.status = "cancelled";
      const extra = extraOf(r);
      extra.cancel = { at, by: me.name, reasonCode, note };
      extra.history.push({ at, action: "cancelled", by: me.name, reason: note ?? reasonCode });
    }
  }

  function checkCancel(r: IssuedReceipt, me: SevaMe): void {
    if (r.status === "cancelled") throw new Refusal("already_cancelled");
    if (me.actions.includes("receipt.cancel_any")) return;
    if (!me.actions.includes("receipt.cancel_own")) throw new Refusal("forbidden");
    const extra = extraOf(r);
    if (extra.issuedByStaffId !== null && extra.issuedByStaffId !== me.staffId) throw new Refusal("forbidden");
    const deadline = new Date(r.issuedAt).getTime() + setting("rules").cancelWindowMinutes * 60_000;
    if (now().getTime() > deadline) throw new Refusal("cancel_window_passed");
  }

  function listItem(r: IssuedReceipt): Record<string, unknown> {
    const extra = extraOf(r);
    return {
      id: r.id ?? r.clientReceiptId,
      receiptNo: r.receiptNo,
      series: r.seriesCode,
      businessDate: businessDate(new Date(r.issuedAt)),
      issuedAt: r.issuedAt,
      devoteeName: r.devotee.name,
      sevas: r.lines.map((l) => (l.quantity > 1 ? `${l.nameEn} x ${l.quantity}` : l.nameEn)).join(", "),
      totalPaise: r.totalPaise,
      mode: r.payment.mode,
      status: r.status,
      changed: r.lines.some((l) => l.changed),
      printCount: r.printCount,
      prasadam: r.prasadam,
      groupNo: r.groupNo,
      position: r.position,
      count: r.count,
      issuedByStaffId: extra.issuedByStaffId,
      cancelDeadline:
        r.status === "issued" ? new Date(new Date(r.issuedAt).getTime() + setting("rules").cancelWindowMinutes * 60_000).toISOString() : null,
      refundState: "none",
    };
  }

  /** No amounts and no phone: what the prasadam counter may see. */
  function prasadamReceipt(r: IssuedReceipt): Record<string, unknown> {
    return {
      id: r.id ?? r.clientReceiptId,
      receiptNo: r.receiptNo,
      devoteeName: r.devotee.name,
      sevaDate: r.sevaDate,
      issuedAt: r.issuedAt,
      groupLine: r.count > 1 ? `${r.position} of ${r.count}` : null,
      lines: r.lines.map((l) => ({ nameEn: l.nameEn, nameKn: l.nameKn, quantity: l.quantity, prasadamItems: l.prasadamItems })),
    };
  }

  /** `offDate` is 'before' when the devotee comes before the seva date and 'after' when they come later. */
  function prasadamState(r: IssuedReceipt): Record<string, unknown> {
    const receipt = prasadamReceipt(r);
    const extra = extraOf(r);
    if (r.status === "cancelled") {
      return {
        state: "cancelled",
        receipt,
        cancelledAt: extra.cancel?.at ?? r.issuedAt,
        cancelledBy: extra.cancel?.by ?? "",
        reason: extra.cancel?.note ?? extra.cancel?.reasonCode ?? "",
      };
    }
    if (r.prasadam === "none") return { state: "no_prasadam", receipt };
    if (r.prasadam === "given") return { state: "already_given", receipt, givenAt: extra.given?.at ?? "", givenBy: extra.given?.by ?? "" };
    const days = dayDiff(today(), r.sevaDate);
    if (days !== 0) {
      const todays = state.receipts.find((x) => x.groupNo === r.groupNo && x.sevaDate === today() && x.status === "issued");
      return {
        state: "another_day",
        receipt,
        offDate: days > 0 ? "before" : "after",
        days: Math.abs(days),
        todaysSlip: todays ? { receiptNo: todays.receiptNo, position: todays.position, count: todays.count } : null,
      };
    }
    return { state: "ready", receipt };
  }

  function lookup(q: string): Record<string, unknown> {
    const parsed = parseLookupInput(q, { year: istParts(now()).year });
    let found: IssuedReceipt[] = [];
    if (parsed.kind === "token") found = state.receipts.filter((r) => r.qrToken === parsed.token);
    if (parsed.kind === "number") found = state.receipts.filter((r) => r.receiptNo === parsed.receiptNo);
    if (parsed.kind === "short") {
      found = state.receipts.filter((r) => {
        const parts = parseReceiptNo(r.receiptNo);
        return parts !== null && parts.running === parsed.running && parts.year === parsed.year && (parsed.series === null || parts.series === parsed.series);
      });
    }
    if (found.length === 0) return { state: "not_found", query: q };
    if (found.length > 1) {
      return {
        state: "choose",
        options: found.map((r) => ({ receiptId: r.id ?? r.clientReceiptId, receiptNo: r.receiptNo, sevaDate: r.sevaDate, devoteeName: r.devotee.name })),
      };
    }
    return prasadamState(found[0]);
  }

  function bootstrap(me: SevaMe): CounterBootstrap {
    const counter = counterOf(me);
    const todayDate = today();
    const todays = state.receipts.filter((r) => r.status === "issued" && businessDate(new Date(r.issuedAt)) === todayDate);
    const sum = (mode: string): number => todays.filter((r) => r.payment.mode === mode).reduce((s, r) => s + r.totalPaise, 0);
    const upi = setting("upi");
    return {
      counter,
      catalogue: state.catalogue.filter((s) => s.active && s.visibility !== "online").sort((a, b) => a.key - b.key),
      slip: setting("slip"),
      rules: setting("rules"),
      denominations: setting("denominations"),
      festivalChips: setting("festivalDays").filter((f) => f.dates.some((d) => d >= todayDate)),
      nextNumbers: [counter.onlineSeries, counter.offlineSeries].map((series) => ({ series, nextRunningNo: (state.lastNo[series] ?? 0) + 1 })),
      lastOfNo: state.lastNo[counter.offlineSeries] ?? 0,
      today: { businessDate: todayDate, receipts: todays.length, cashPaise: sum("cash"), upiPaise: sum("upi"), dayClosed: state.dayClosed },
      upi,
      upiDisabledReason: upi ? null : "not_configured",
      serverTime: now().toISOString(),
      siteUrl: E2E_SITE_URL,
    };
  }

  function receiptOrThrow(id: string): IssuedReceipt {
    const r = findReceipt(id);
    if (!r) throw new Refusal("not_found");
    return r;
  }

  function staffList(): Record<string, unknown>[] {
    return state.staff.filter(isRecord);
  }

  const builtIns: BuiltIn[] = [
    { method: "GET", pattern: "me", action: "me", run: ({ me }) => me },
    { method: "GET", pattern: "counter/bootstrap", action: "counter.issue", run: ({ me }) => bootstrap(me) },
    { method: "POST", pattern: "counter/orders", action: "counter.issue", run: ({ body, me }) => issueOrder(body, me) },
    {
      method: "POST",
      pattern: "counter/sync",
      action: "counter.issue",
      run: ({ body, me }): SyncResponse => {
        if (!isRecord(body) || !Array.isArray(body.items)) throw new Refusal("validation");
        const items = (body.items as OutboxItem[]).slice().sort((a, b) => a.seq - b.seq);
        return {
          results: items.map((item) => {
            if (item.kind === "order") return { seq: item.seq, ...syncOrder(item.payload, me) };
            const targets = item.clientReceiptIds.map((id) => findReceipt(id));
            if (targets.some((t) => t === undefined)) return { seq: item.seq, ok: false, code: "not_found" };
            const live = (targets as IssuedReceipt[]).filter((t) => t.status === "issued");
            cancelReceipts(live, me, item.reasonCode, item.note ?? null, item.at);
            return { seq: item.seq, ok: true, duplicate: live.length === 0 };
          }),
        };
      },
    },
    {
      method: "POST",
      pattern: "counter/prints",
      action: "counter.issue",
      run: ({ body, me }) => {
        if (!isRecord(body) || !Array.isArray(body.receiptIds) || !body.receiptIds.every(isString)) throw new Refusal("validation");
        const targets = (body.receiptIds as string[]).map(receiptOrThrow);
        if (targets.some((r) => r.status === "cancelled")) throw new Refusal("cannot_reprint_cancelled");
        if (targets.some((r) => r.printCount >= 1) && !me.actions.includes("receipt.reprint")) throw new Refusal("forbidden");
        const at = now().toISOString();
        return {
          receipts: targets.map((r) => {
            r.printCount += 1;
            extraOf(r).history.push({ at, action: r.printCount > 1 ? "reprinted" : "printed", by: me.name, reason: null });
            return { id: r.id ?? r.clientReceiptId, printCount: r.printCount, duplicate: r.printCount > 1 };
          }),
        };
      },
    },
    {
      method: "POST",
      pattern: "counter/heartbeat",
      action: "counter.heartbeat",
      run: ({ me }) => {
        const counter = counterOf(me);
        return { serverTime: now().toISOString(), ofSeries: counter.offlineSeries, lastOfNo: state.lastNo[counter.offlineSeries] ?? 0, dayClosed: state.dayClosed };
      },
    },
    { method: "POST", pattern: "counter/devices", action: "device.register", run: () => ({ deviceId: nextId("device") }) },
    {
      method: "GET",
      pattern: "receipts",
      action: "receipts.list",
      run: ({ query, me }) => {
        const from = me.role === "receptionist" ? today() : query.get("from");
        const to = me.role === "receptionist" ? today() : query.get("to");
        const status = query.get("status");
        const text = (query.get("q") ?? "").trim().toLowerCase();
        const rows = state.receipts
          .filter((r) => {
            const day = businessDate(new Date(r.issuedAt));
            if (from && day < from) return false;
            if (to && day > to) return false;
            if (query.get("sevaId") && !r.lines.some((l) => l.sevaId === query.get("sevaId"))) return false;
            if (query.get("mode") && r.payment.mode !== query.get("mode")) return false;
            if (status === "issued" || status === "cancelled") return r.status === status;
            if (status === "changed") return r.lines.some((l) => l.changed);
            if (status === "duplicate") return r.printCount > 1;
            if (status === "prasadam_pending") return r.prasadam === "pending" && r.status === "issued";
            return true;
          })
          .filter((r) => text === "" || r.receiptNo.toLowerCase().includes(text) || r.devotee.name.toLowerCase().includes(text))
          .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
          .map(listItem);
        return { rows, nextCursor: null };
      },
    },
    {
      method: "POST",
      pattern: "receipts/cancel",
      action: "receipt.cancel_own",
      run: ({ body, me }) => {
        if (!isRecord(body) || !Array.isArray(body.receiptIds) || body.receiptIds.length === 0 || !body.receiptIds.every(isString) || !isString(body.reasonCode)) {
          throw new Refusal("validation");
        }
        const targets = (body.receiptIds as string[]).map(receiptOrThrow);
        targets.forEach((r) => checkCancel(r, me));
        cancelReceipts(targets, me, body.reasonCode as CancelReasonCode, typeof body.note === "string" ? body.note : null, now().toISOString());
        return { receipts: targets.map(listItem) };
      },
    },
    {
      method: "POST",
      pattern: "receipts/:id/reissue",
      action: "receipt.cancel_own",
      run: ({ params, me }): IssueResponse => {
        const old = receiptOrThrow(params.id);
        checkCancel(old, me);
        const at = now().toISOString();
        cancelReceipts([old], me, "spoiled_print", null, at);
        const counter = counterOf(me);
        const p = istParts(now());
        const running = nextRunning(counter.onlineSeries);
        const fresh: IssuedReceipt = {
          ...old,
          id: nextId("receipt"),
          clientReceiptId: `${old.clientReceiptId}-reissue-${seq}`,
          receiptNo: formatReceiptNo({ series: counter.onlineSeries, staffNo: me.staffNo, channel: null, month: p.month, year: p.year, running }),
          seriesCode: counter.onlineSeries,
          qrToken: newQrToken(),
          issuedAt: at,
          issuedBy: { name: me.name, staffNo: me.staffNo },
          issuedOffline: false,
          status: "issued",
          printCount: 0,
        };
        const oldExtra = extraOf(old);
        extras.set(fresh.clientReceiptId, {
          devotee: oldExtra.devotee,
          counterId: counter.id,
          issuedByStaffId: me.staffId,
          history: [{ at, action: "reissued", by: me.name, reason: `replaces ${old.receiptNo}` }],
          cancel: null,
          given: null,
        });
        state.receipts.push(fresh);
        return { orderId: nextId("order"), groupNo: fresh.groupNo, duplicate: false, receipts: [fresh] };
      },
    },
    {
      method: "GET",
      pattern: "receipts/:id",
      action: "receipts.list",
      run: ({ params }) => {
        const r = receiptOrThrow(params.id);
        const extra = extraOf(r);
        return { ...r, history: extra.history, cancel: extra.cancel, refundState: "none" };
      },
    },
    {
      method: "GET",
      pattern: "devotees/search",
      action: "devotees.search",
      run: ({ query }) => {
        const name = (query.get("name") ?? "").trim().toLowerCase();
        const phone = (query.get("phone") ?? "").replace(/\D/g, "");
        if (name === "" && phone === "") return [];
        const seen = new Set<string>();
        const out: Record<string, unknown>[] = [];
        for (const r of [...state.receipts].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))) {
          const d = extraOf(r).devotee;
          const digits = (d.phone ?? "").replace(/\D/g, "");
          const hit = (name !== "" && d.name.toLowerCase().includes(name)) || (phone !== "" && digits.includes(phone));
          const key = `${d.name}|${digits}`;
          if (!hit || seen.has(key)) continue;
          seen.add(key);
          out.push({
            name: d.name,
            gotra: d.gotra?.text ?? null,
            gotraId: d.gotra?.id ?? null,
            nakshatraId: d.nakshatra?.id ?? null,
            rashiId: d.rashi?.id ?? null,
            phoneLast4: digits.length >= 4 ? digits.slice(-4) : null,
            lastVisit: businessDate(new Date(r.issuedAt)),
          });
          if (out.length === 5) break;
        }
        return out;
      },
    },
    { method: "GET", pattern: "prasadam/lookup", action: "prasadam.give", run: ({ query }) => lookup(query.get("q") ?? "") },
    {
      method: "POST",
      pattern: "prasadam/give",
      action: "prasadam.give",
      run: ({ body, me }) => {
        if (!isRecord(body) || !isString(body.receiptId)) throw new Refusal("validation");
        const r = receiptOrThrow(body.receiptId);
        const current = prasadamState(r);
        if (current.state === "another_day") {
          if (body.confirmOffDate !== true) return current;
          if (!me.actions.includes("prasadam.give_off_date")) throw new Refusal("forbidden");
        } else if (current.state !== "ready") {
          return current;
        }
        const at = now().toISOString();
        r.prasadam = "given";
        const extra = extraOf(r);
        extra.given = { at, by: me.name, byStaffId: me.staffId };
        extra.history.push({ at, action: "prasadam_given", by: me.name, reason: null });
        return prasadamState(r);
      },
    },
    {
      method: "POST",
      pattern: "prasadam/undo",
      action: "prasadam.give",
      run: ({ body, me }) => {
        if (!isRecord(body) || !isString(body.receiptId)) throw new Refusal("validation");
        const r = receiptOrThrow(body.receiptId);
        const extra = extraOf(r);
        if (r.prasadam !== "given" || !extra.given) throw new Refusal("not_found");
        const withinUndo = now().getTime() - new Date(extra.given.at).getTime() <= 120_000 && extra.given.byStaffId === me.staffId;
        if (!withinUndo && !me.actions.includes("prasadam.reverse")) throw new Refusal("forbidden");
        r.prasadam = "pending";
        extra.given = null;
        extra.history.push({ at: now().toISOString(), action: "prasadam_undone", by: me.name, reason: typeof body.reason === "string" ? body.reason : null });
        return { ok: true };
      },
    },
    {
      method: "GET",
      pattern: "day-close",
      action: "dayclose.close",
      run: ({ query, me }) => {
        const date = query.get("date") ?? today();
        const day = state.receipts.filter((r) => businessDate(new Date(r.issuedAt)) === date);
        const issued = day.filter((r) => r.status === "issued");
        const sum = (mode: string): number => issued.filter((r) => r.payment.mode === mode).reduce((s, r) => s + r.totalPaise, 0);
        return {
          counterId: Number(query.get("counterId") ?? counterOf(me).id),
          businessDate: date,
          closed: state.dayClosed,
          receipts: issued.length,
          cancelled: day.length - issued.length,
          cashPaise: sum("cash"),
          upiPaise: sum("upi"),
          totalPaise: sum("cash") + sum("upi"),
          outboxCount: 0,
          denominations: setting("denominations"),
        };
      },
    },
    {
      method: "POST",
      pattern: "day-close",
      action: "dayclose.close",
      run: () => {
        if (state.dayClosed) throw new Refusal("day_already_closed");
        state.dayClosed = true;
        return { dayCloseId: nextId("dayclose") };
      },
    },
    {
      method: "POST",
      pattern: "day-close/reopen",
      action: "dayclose.reopen",
      run: () => {
        state.dayClosed = false;
        return { ok: true };
      },
    },
    { method: "GET", pattern: "reports/dashboard", action: "reports.view", run: () => state.dashboard },
    {
      method: "POST",
      pattern: "reports/export/audit",
      action: "export.basic",
      run: ({ body, me }) => {
        if (isRecord(body) && body.includePhones === true && !me.actions.includes("export.with_phones")) throw new Refusal("forbidden");
        return { ok: true };
      },
    },
    {
      method: "GET",
      pattern: "reports/:name",
      action: "reports.view",
      run: ({ params, query, me }) => {
        if (params.name === "export" && query.get("includePhones") === "true" && !me.actions.includes("export.with_phones")) {
          throw new Refusal("forbidden");
        }
        return reports[params.name] ?? { rows: [], nextCursor: null };
      },
    },
    { method: "GET", pattern: "sevas", action: "sevas.read", run: () => [...state.catalogue].sort((a, b) => a.key - b.key) },
    {
      method: "POST",
      pattern: "sevas/reorder",
      action: "sevas.edit",
      run: ({ body }) => {
        if (!isRecord(body) || !Array.isArray(body.ids) || !body.ids.every(isString)) throw new Refusal("validation");
        (body.ids as string[]).forEach((id, i) => {
          const s = state.catalogue.find((x) => x.id === id);
          if (s) s.key = i + 1;
        });
        return [...state.catalogue].sort((a, b) => a.key - b.key);
      },
    },
    {
      method: "POST",
      pattern: "sevas",
      action: "sevas.edit",
      run: ({ body }) => {
        if (!isRecord(body) || !isString(body.nameEn)) throw new Refusal("validation");
        const created: CatalogueSeva = {
          code: null,
          nameKn: null,
          ratePaise: 0,
          multiDate: false,
          allowAmountChange: true,
          prasadamGiven: true,
          prasadamItems: null,
          visibility: "both",
          active: true,
          category: "Pooja",
          incomeLedger: null,
          ...(body as Partial<CatalogueSeva>),
          id: nextId("seva"),
          key: state.catalogue.reduce((m, s) => Math.max(m, s.key), 0) + 1,
          nameEn: body.nameEn,
        };
        state.catalogue.push(created);
        return created;
      },
    },
    {
      method: "PUT",
      pattern: "sevas/:id",
      action: "sevas.edit",
      run: ({ params, body }) => {
        const s = state.catalogue.find((x) => x.id === params.id);
        if (!s) throw new Refusal("not_found");
        if (!isRecord(body)) throw new Refusal("validation");
        Object.assign(s, body as Partial<CatalogueSeva>, { id: s.id });
        return s;
      },
    },
    {
      method: "GET",
      pattern: "sevas/:id",
      action: "sevas.read",
      run: ({ params }) => {
        const s = state.catalogue.find((x) => x.id === params.id);
        if (!s) throw new Refusal("not_found");
        return s;
      },
    },
    {
      method: "GET",
      pattern: "settings/:section",
      action: "settings.edit",
      run: ({ params }) => {
        const value = settings()[params.section];
        if (value === undefined) throw new Refusal("not_found");
        return value;
      },
    },
    {
      method: "PUT",
      pattern: "settings/:section",
      action: "settings.edit",
      run: ({ params, body }) => {
        settings()[params.section] = body;
        return body;
      },
    },
    { method: "GET", pattern: "staff", action: "staff.onboard", run: () => state.staff },
    {
      method: "POST",
      pattern: "staff",
      action: "staff.onboard",
      run: ({ body, me }) => {
        if (!isRecord(body) || !isString(body.name) || !isString(body.email) || !isString(body.role)) throw new Refusal("validation");
        if (body.role === "super_admin" && !me.actions.includes("staff.grant_super_admin")) throw new Refusal("forbidden");
        const created = {
          viewOnly: false,
          ...body,
          id: nextId("staff"),
          staffNo: staffList().reduce((m, s) => Math.max(m, typeof s.staffNo === "number" ? s.staffNo : 0), 0) + 1,
          status: "invited",
        };
        state.staff.push(created);
        return created;
      },
    },
    {
      method: "GET",
      pattern: "staff/:id",
      action: "staff.onboard",
      run: ({ params }) => {
        const s = staffList().find((x) => x.id === params.id);
        if (!s) throw new Refusal("not_found");
        return s;
      },
    },
    {
      method: "PUT",
      pattern: "staff/:id",
      action: "staff.change_role",
      run: ({ params, body, me }) => {
        const s = staffList().find((x) => x.id === params.id);
        if (!s) throw new Refusal("not_found");
        if (!isRecord(body)) throw new Refusal("validation");
        if (body.role === "super_admin" && !me.actions.includes("staff.grant_super_admin")) throw new Refusal("forbidden");
        Object.assign(s, body, { id: s.id, staffNo: s.staffNo });
        return s;
      },
    },
    { method: "POST", pattern: "gaps/:id", action: "gap.resolve", run: () => ({ ok: true }) },
  ];

  async function handle(req: FakeRequest & { role?: E2ERole | null }): Promise<FakeResult> {
    const method = req.method.toUpperCase();
    requests.push({ method, path: req.path, body: req.body });
    const route = routeOf(req.path);

    const failureAt = failures.findIndex((f) => route.startsWith(routeOf(f.prefix)));
    if (failureAt !== -1) {
      const [{ kind }] = failures.splice(failureAt, 1);
      if (kind === "timeout") return { kind: "abort", reason: "timedout" };
      if (kind === "network") return { kind: "abort", reason: "failed" };
      return errorResult(kind.code, undefined, kind.status);
    }

    const extension = extensions.find((e) => (e.method === null || e.method === method) && matchPattern(e.pattern, route) !== null);
    if (extension) {
      try {
        const value = await extension.handler({ method, path: req.path, body: req.body });
        if (value instanceof FakeReply) return { kind: "json", status: value.status, body: value.body };
        return { kind: "json", status: 200, body: value ?? { ok: true } };
      } catch (error) {
        if (error instanceof FakeApiError) return errorResult(error.code, error.detail, error.status);
        throw error;
      }
    }

    let builtIn: BuiltIn | null = null;
    let params: Record<string, string> = {};
    for (const candidate of builtIns) {
      const matched = candidate.method === method ? matchPattern(candidate.pattern, route) : null;
      if (matched) {
        builtIn = candidate;
        params = matched;
        break;
      }
    }
    if (!builtIn) return errorResult("not_found");

    const role = req.role ?? null;
    if (role === null) return errorResult("unauthenticated");
    const me = state.me[role];
    if (!me) return errorResult("staff_inactive");
    if (me.viewOnly && method !== "GET") return errorResult("view_only");
    if (!me.actions.includes(builtIn.action)) return errorResult("forbidden");

    try {
      const body = builtIn.run({ method, route, params, query: queryOf(req.path), body: req.body, me });
      return { kind: "json", status: 200, body };
    } catch (error) {
      if (error instanceof Refusal) return errorResult(error.code, error.detail, error.status);
      return errorResult("internal");
    }
  }

  return {
    state,
    requests,
    handle,
    async install(page: Page): Promise<void> {
      await page.route("**/api/seva/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const raw = request.postData();
        let body: unknown = null;
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            body = raw;
          }
        }
        const role = roleFromAuthorization(await request.headerValue("authorization"));
        const result = await handle({ method: request.method(), path: `${url.pathname}${url.search}`, body, role });
        if (result.kind === "abort") {
          await route.abort(result.reason);
          return;
        }
        await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result.body) });
      });
    },
    failNext(pathPrefix: string, kind: FakeFailure): void {
      failures.push({ prefix: pathPrefix, kind });
    },
    setNow(iso: string): void {
      if (Number.isNaN(new Date(iso).getTime())) throw new RangeError(`setNow: not a date: ${iso}`);
      fixedNow = iso;
    },
    extend(handlers: Record<string, FakeHandler>): void {
      for (const [key, handler] of Object.entries(handlers)) {
        const match = /^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i.exec(key.trim());
        const method = match ? match[1].toUpperCase() : null;
        const pattern = routeOf(match ? match[2] : key.trim());
        // Later calls win over earlier ones and over the built-in routes.
        extensions.unshift({ method, pattern, handler });
      }
    },
  };
}
