/**
 * The counter order engine (Design Book 9.2-9.7): a pure reducer and selectors behind the three-step counter screen.
 * No React and no I/O; the counter hook (A4-1) owns effects, focus and the network.
 */
import type { CatalogueSeva } from "@/types/seva";
import { groupLinesByDate, type CounterLine, type GroupResult } from "@/lib/seva/grouping";
import { toPaise } from "@/lib/seva/money";
import { sevaDateBounds } from "@/lib/seva/time";

export type CounterStep = 1 | 2 | 3;

export interface DevoteeDraft {
  name: string;
  gotra: { value?: string; text: string } | null;
  nakshatra: { value?: string; text: string } | null;
  rashi: { value?: string; text: string } | null;
  phone: string;
}

export interface PaymentDraft {
  mode: "cash" | "upi";
  cashReceived: string;
  upiRefLast6: string;
  upiSeenConfirmed: boolean;
}

export interface CounterState {
  step: CounterStep;
  /** Business date 'YYYY-MM-DD' (IST); new lines default to it and no line may be dated before it (C-29). */
  today: string;
  devotee: DevoteeDraft;
  lines: CounterLine[];
  payment: PaymentDraft;
  /** Time of the first Esc of a possible double Esc; null when not armed. */
  escArmedAt: number | null;
  submitting: boolean;
  confirmLargeCash: boolean;
  search: string;
}

export type CounterAction =
  | { type: "setDevotee"; patch: Partial<DevoteeDraft> }
  | { type: "applyProfile"; devotee: DevoteeDraft }
  | { type: "setSearch"; text: string }
  | { type: "addByKey"; key: number }
  | { type: "addByCode"; code: string }
  | { type: "removeLine"; lineKey: string }
  | { type: "setQuantity"; lineKey: string; quantity: number }
  | { type: "setDates"; lineKey: string; dates: string[] }
  | { type: "changeAmount"; lineKey: string; unitRatePaise: number; reason: string }
  | { type: "goStep"; step: CounterStep }
  | { type: "setPayment"; patch: Partial<PaymentDraft> }
  | { type: "confirmLargeCash" }
  | { type: "escape"; at: number }
  | { type: "submitStarted" }
  | { type: "submitFinished"; ok: boolean }
  | { type: "reset"; today: string };

export interface CatalogueIndex {
  /** Every seva, for looking up a line's seva. */
  byId: Map<string, CatalogueSeva>;
  /** Active sevas shown on the counter, by their tile number. */
  byKey: Map<number, CatalogueSeva>;
  /** Active sevas shown on the counter, by their upper-case letter code. */
  byCode: Map<string, CatalogueSeva>;
}

export type SaveBlock =
  | "no_name"
  | "no_lines"
  | "group_error"
  | "reason_missing"
  | "amount_missing"
  | "upi_incomplete"
  | "cash_short"
  | "large_cash_unconfirmed"
  | "submitting";

/** Esc twice within this many milliseconds clears the order (DB 9.6). */
export const ESC_WINDOW_MS = 2000;
/** Cash of Rs 2,00,000 or more in one order needs a confirm (C-54, s.269ST). */
export const LARGE_CASH_PAISE = 20_000_000;
/** The SQL function refuses a changed amount whose reason is shorter than this (change_reason_required). */
export const MIN_CHANGE_REASON_CHARS = 3;
export const MAX_QUANTITY = 99;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LINE_KEY_PATTERN = /^L(\d+)$/;

function emptyDevotee(): DevoteeDraft {
  return { name: "", gotra: null, nakshatra: null, rashi: null, phone: "" };
}

export function initialCounterState(today: string): CounterState {
  return {
    step: 1,
    today,
    devotee: emptyDevotee(),
    lines: [],
    payment: { mode: "cash", cashReceived: "", upiRefLast6: "", upiSeenConfirmed: false },
    escArmedAt: null,
    submitting: false,
    confirmLargeCash: false,
    search: "",
  };
}

function onCounter(seva: CatalogueSeva): boolean {
  return seva.active && seva.visibility !== "online";
}

export function indexCatalogue(c: CatalogueSeva[]): CatalogueIndex {
  const index: CatalogueIndex = { byId: new Map(), byKey: new Map(), byCode: new Map() };
  for (const seva of c) {
    index.byId.set(seva.id, seva);
    if (!onCounter(seva)) continue;
    index.byKey.set(seva.key, seva);
    if (seva.code) index.byCode.set(seva.code.toUpperCase(), seva);
  }
  return index;
}

function startsAWord(name: string | null, q: string): boolean {
  if (!name) return false;
  return name
    .normalize("NFC")
    .toLowerCase()
    .split(/\s+/)
    .some((word) => word.startsWith(q));
}

/**
 * Counter sevas for the tile grid, filtered by the search text (DB 9.3): by tile number, then letter code, then a word
 * of the English or Kannada name. An empty search lists every counter seva by tile number.
 */
export function matchSevas(cat: CatalogueIndex, text: string): CatalogueSeva[] {
  const all = [...cat.byKey.values()].sort((a, b) => a.key - b.key);
  const q = text.normalize("NFC").trim().toLowerCase();
  if (q.length === 0) return all;
  const rank = (s: CatalogueSeva): number => {
    const code = (s.code ?? "").toLowerCase();
    if (String(s.key) === q || code === q) return 0;
    if (code.length > 0 && code.startsWith(q)) return 1;
    if (startsAWord(s.nameEn, q) || startsAWord(s.nameKn, q)) return 2;
    return -1;
  };
  return all
    .map((seva) => ({ seva, r: rank(seva) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.seva.key - b.seva.key)
    .map((x) => x.seva);
}

function nextLineKey(lines: CounterLine[]): string {
  let max = 0;
  for (const line of lines) {
    const match = LINE_KEY_PATTERN.exec(line.key);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `L${max + 1}`;
}

function addSeva(s: CounterState, seva: CatalogueSeva | undefined): CounterState {
  if (!seva || !onCounter(seva)) return s;
  const line: CounterLine = {
    key: nextLineKey(s.lines),
    sevaId: seva.id,
    quantity: 1,
    // An any-amount seva starts at 0 until the receptionist types the amount (amount_missing).
    unitRatePaise: seva.ratePaise ?? 0,
    catalogueRatePaise: seva.ratePaise,
    dates: [s.today],
  };
  return { ...s, lines: [...s.lines, line], search: "" };
}

/** Exact code, then a tile number, then the only seva the text filters down to. */
function findByCode(cat: CatalogueIndex, code: string): CatalogueSeva | undefined {
  const q = code.trim();
  if (q.length === 0) return undefined;
  const exact = cat.byCode.get(q.toUpperCase());
  if (exact) return exact;
  if (/^\d+$/.test(q)) return cat.byKey.get(Number(q));
  const matches = matchSevas(cat, q);
  return matches.length === 1 ? matches[0] : undefined;
}

function updateLine(s: CounterState, lineKey: string, update: (line: CounterLine) => CounterLine | null): CounterState {
  const index = s.lines.findIndex((l) => l.key === lineKey);
  if (index < 0) return s;
  const next = update(s.lines[index]);
  if (next === null) return s;
  const lines = [...s.lines];
  lines[index] = next;
  return { ...s, lines };
}

function withoutReason(line: CounterLine, unitRatePaise: number): CounterLine {
  const copy: CounterLine = { ...line, unitRatePaise };
  delete copy.changeReason;
  return copy;
}

function changeAmount(cat: CatalogueIndex, line: CounterLine, unitRatePaise: number, reason: string): CounterLine | null {
  if (!Number.isSafeInteger(unitRatePaise) || unitRatePaise < 0) return null;
  // Any-amount seva (Other Seva / Karnike): the typed amount is not a change and needs no reason (DB 9.3).
  if (line.catalogueRatePaise === null) return withoutReason(line, unitRatePaise);
  const seva = cat.byId.get(line.sevaId);
  if (!seva || !seva.allowAmountChange) return null;
  if (unitRatePaise === line.catalogueRatePaise) return withoutReason(line, unitRatePaise);
  if (unitRatePaise === 0) return null;
  const trimmed = reason.trim();
  const next = withoutReason(line, unitRatePaise);
  return trimmed.length > 0 ? { ...next, changeReason: trimmed } : next;
}

function setDates(cat: CatalogueIndex, s: CounterState, line: CounterLine, dates: string[], daysAhead: number): CounterLine | null {
  const seva = cat.byId.get(line.sevaId);
  if (!seva) return null;
  const unique = [...new Set(dates)].sort();
  if (unique.length === 0) return null;
  if (!seva.multiDate && unique.length > 1) return null;
  const { min, max } = sevaDateBounds(s.today, daysAhead);
  if (unique.some((d) => !DATE_PATTERN.test(d) || d < min || d > max)) return null;
  return { ...line, dates: unique };
}

function setQuantity(line: CounterLine, quantity: number): CounterLine | null {
  if (!Number.isFinite(quantity)) return null;
  return { ...line, quantity: Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(quantity))) };
}

function sanitisePayment(patch: Partial<PaymentDraft>): Partial<PaymentDraft> {
  if (patch.upiRefLast6 === undefined) return patch;
  return { ...patch, upiRefLast6: patch.upiRefLast6.replace(/\D/g, "").slice(0, 6) };
}

function orderTotalPaise(lines: CounterLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.unitRatePaise * new Set(l.dates).size, 0);
}

function apply(cat: CatalogueIndex, daysAhead: number, s: CounterState, a: CounterAction): CounterState {
  switch (a.type) {
    case "setDevotee":
      return { ...s, devotee: { ...s.devotee, ...a.patch } };
    case "applyProfile":
      // A profile only knows the last 4 phone digits, so a phone typed to find the devotee is kept.
      return { ...s, devotee: { ...a.devotee, phone: a.devotee.phone || s.devotee.phone } };
    case "setSearch":
      return { ...s, search: a.text };
    case "addByKey":
      return addSeva(s, cat.byKey.get(a.key));
    case "addByCode":
      return addSeva(s, findByCode(cat, a.code));
    case "removeLine":
      return s.lines.some((l) => l.key === a.lineKey) ? { ...s, lines: s.lines.filter((l) => l.key !== a.lineKey) } : s;
    case "setQuantity":
      return updateLine(s, a.lineKey, (l) => setQuantity(l, a.quantity));
    case "setDates":
      return updateLine(s, a.lineKey, (l) => setDates(cat, s, l, a.dates, daysAhead));
    case "changeAmount":
      return updateLine(s, a.lineKey, (l) => changeAmount(cat, l, a.unitRatePaise, a.reason));
    case "goStep":
      return { ...s, step: a.step };
    case "setPayment":
      return { ...s, payment: { ...s.payment, ...sanitisePayment(a.patch) } };
    case "confirmLargeCash":
      return { ...s, confirmLargeCash: true };
    case "submitStarted":
      return { ...s, submitting: true };
    case "submitFinished":
      // A good save clears the order for the next devotee; a failed one keeps the form as typed.
      return a.ok ? initialCounterState(s.today) : { ...s, submitting: false };
    case "reset":
      return initialCounterState(a.today);
    case "escape":
      if (s.escArmedAt !== null && a.at >= s.escArmedAt && a.at - s.escArmedAt <= ESC_WINDOW_MS) {
        return initialCounterState(s.today);
      }
      return { ...s, escArmedAt: a.at };
  }
}

/**
 * The counter reducer. While a save is in flight every action except submitFinished and reset is ignored, so the
 * order on screen is the order being saved. Any action other than Esc disarms a pending double Esc, and a change of
 * the total or of the payment mode asks for the large-cash confirm again.
 */
export function counterReducer(cat: CatalogueIndex, counterDaysAhead: number): (s: CounterState, a: CounterAction) => CounterState {
  return (s, a) => {
    if (s.submitting && a.type !== "submitFinished" && a.type !== "reset") return s;
    const next = apply(cat, counterDaysAhead, s, a);
    if (next === s || a.type === "escape" || a.type === "submitFinished" || a.type === "reset") return next;
    const disarmed = next.escArmedAt === null ? next : { ...next, escArmedAt: null };
    const recheckCash =
      disarmed.confirmLargeCash &&
      (orderTotalPaise(disarmed.lines) !== orderTotalPaise(s.lines) || disarmed.payment.mode !== s.payment.mode);
    return recheckCash ? { ...disarmed, confirmLargeCash: false } : disarmed;
  };
}

export function selectGroups(s: CounterState): GroupResult {
  return groupLinesByDate(s.lines);
}

function isChanged(line: CounterLine): boolean {
  return line.catalogueRatePaise !== null && line.unitRatePaise !== line.catalogueRatePaise;
}

/** Order of checks follows the screen: devotee, sevas, then payment. */
export function selectCanSave(s: CounterState): { ok: true } | { ok: false; block: SaveBlock } {
  if (s.submitting) return { ok: false, block: "submitting" };
  if (s.devotee.name.trim().length === 0) return { ok: false, block: "no_name" };
  if (s.lines.length === 0) return { ok: false, block: "no_lines" };
  const groups = selectGroups(s);
  if (!groups.ok) return { ok: false, block: "group_error" };
  if (s.lines.some((l) => l.catalogueRatePaise === null && l.unitRatePaise <= 0)) return { ok: false, block: "amount_missing" };
  if (s.lines.some((l) => isChanged(l) && Array.from((l.changeReason ?? "").trim()).length < MIN_CHANGE_REASON_CHARS)) {
    return { ok: false, block: "reason_missing" };
  }
  if (s.payment.mode === "upi") {
    if (!/^\d{6}$/.test(s.payment.upiRefLast6) || !s.payment.upiSeenConfirmed) return { ok: false, block: "upi_incomplete" };
    return { ok: true };
  }
  const received = s.payment.cashReceived.trim();
  if (received.length > 0) {
    let receivedPaise: number;
    try {
      receivedPaise = toPaise(received);
    } catch {
      return { ok: false, block: "cash_short" };
    }
    if (receivedPaise < groups.totalPaise) return { ok: false, block: "cash_short" };
  }
  if (groups.totalPaise >= LARGE_CASH_PAISE && !s.confirmLargeCash) return { ok: false, block: "large_cash_unconfirmed" };
  return { ok: true };
}
