/**
 * Turns the counter state into the order the server issues (CounterOrderPayload, DB 9.7), and a returning devotee's
 * profile into step 1's draft. Pure: the caller makes the ids and QR tokens (crypto) and checks selectCanSave first.
 */
import type { CounterLineInput, CounterOrderPayload, DevoteeInput, SevaLists } from "@/types/seva";
import { GOTRAS } from "@/lib/seva/domain/gotras";
import { findListOption, slipNameLists } from "@/lib/seva/domain/lists";
import { NAKSHATRAS } from "@/lib/seva/domain/nakshatras";
import { RASHIS } from "@/lib/seva/domain/rashis";
import { findOption, type DomainOption } from "@/lib/seva/domain/options";
import { toPaise } from "@/lib/seva/money";
import type { ReceiptGroup } from "@/lib/seva/grouping";
import { selectGroups, type CounterState, type DevoteeDraft } from "./state";

type Picked = { value?: string; text: string } | null;

const ID = /^\d+$/;

function pickedId(p: Picked): number | undefined {
  return p?.value !== undefined && ID.test(p.value) ? Number(p.value) : undefined;
}

function pickedText(p: Picked): string | undefined {
  const text = p?.text.trim() ?? "";
  return text.length > 0 ? text : undefined;
}

/** Same rule as the shared zod schema: +91, 91 or 0 prefix, spaces and hyphens allowed. Anything else is sent as typed. */
function normalisePhone(raw: string): string | undefined {
  const compact = raw.replace(/[\s\-().]/g, "");
  if (compact.length === 0) return undefined;
  const match = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(compact);
  return match ? `+91${match[1]}` : compact;
}

function toDevoteeInput(d: DevoteeDraft): DevoteeInput {
  const devotee: DevoteeInput = { name: d.name.trim() };
  const gotraText = pickedText(d.gotra);
  if (gotraText !== undefined) {
    const id = pickedId(d.gotra);
    devotee.gotra = id === undefined ? { text: gotraText } : { text: gotraText, id };
  }
  for (const field of ["nakshatra", "rashi"] as const) {
    const id = pickedId(d[field]);
    const text = pickedText(d[field]);
    if (id === undefined && text === undefined) continue;
    devotee[field] = { ...(id !== undefined ? { id } : {}), ...(text !== undefined ? { text } : {}) };
  }
  const phone = normalisePhone(d.phone);
  if (phone !== undefined) devotee.phone = phone;
  return devotee;
}

function toLineInput(line: ReceiptGroup["lines"][number]): CounterLineInput {
  const input: CounterLineInput = { sevaId: line.sevaId, quantity: line.quantity };
  const anyAmount = line.catalogueRatePaise === null;
  const changed = !anyAmount && line.unitRatePaise !== line.catalogueRatePaise;
  // The server prices a line from the catalogue unless a rate is sent: only for changed or any-amount lines.
  if (anyAmount || changed) input.unitRatePaise = line.unitRatePaise;
  const reason = line.changeReason?.trim() ?? "";
  if (changed && reason.length > 0) input.changeReason = reason;
  return input;
}

/**
 * One receipt per seva date, dates ascending (groupLinesByDate). `ids.clientReceiptIds[i]` and `ids.qrTokens[i]`
 * belong to the i-th receipt. Throws Error(<group code>) when the order cannot be grouped and
 * RangeError('receipt_ids_mismatch') when the id lists do not match the number of receipts.
 */
export function buildCounterOrderPayload(
  s: CounterState,
  ids: { clientOrderId: string; clientReceiptIds: string[]; qrTokens: string[] },
): CounterOrderPayload {
  const groups = selectGroups(s);
  if (!groups.ok) throw new Error(groups.code);
  const count = groups.receipts.length;
  if (ids.clientReceiptIds.length !== count || ids.qrTokens.length !== count) {
    throw new RangeError("receipt_ids_mismatch");
  }

  const receipts = groups.receipts.map((group, i) => ({
    clientReceiptId: ids.clientReceiptIds[i],
    sevaDate: group.sevaDate,
    qrToken: ids.qrTokens[i],
    lines: group.lines.map(toLineInput),
  }));

  const received = s.payment.cashReceived.trim();
  const payment: CounterOrderPayload["payment"] =
    s.payment.mode === "upi"
      ? { mode: "upi", upiRefLast6: s.payment.upiRefLast6, upiSeenConfirmed: s.payment.upiSeenConfirmed }
      : received.length > 0
        ? { mode: "cash", cashReceivedPaise: toPaise(received) }
        : { mode: "cash" };

  return {
    clientOrderId: ids.clientOrderId,
    devotee: toDevoteeInput(s.devotee),
    receipts,
    payment,
    expectedTotalPaise: groups.totalPaise,
  };
}

function optionDraft(options: readonly DomainOption[], id: number | undefined): Picked {
  const option = findOption(options, id);
  return option ? { value: String(option.id), text: option.en } : null;
}

/**
 * A returning devotee's details for step 1. Only the last 4 phone digits are known, so the phone stays blank.
 * `lists` are the bootstrap's lists temple admins keep, so a gotra they added (id 1000 up) keeps its id; without them
 * the built-in lists are used.
 */
export function profileToDraft(
  p: {
    name: string;
    gotra?: string;
    gotraId?: number;
    nakshatraId?: number;
    rashiId?: number;
    phoneLast4?: string;
  },
  lists?: SevaLists | null,
): DevoteeDraft {
  const gotraText = p.gotra?.trim() ?? "";
  const gotraOption = findListOption(slipNameLists(lists).gotras, GOTRAS, p.gotraId);
  let gotra: Picked = null;
  if (gotraText.length > 0) gotra = gotraOption ? { value: String(gotraOption.id), text: gotraText } : { text: gotraText };
  else if (gotraOption) gotra = { value: String(gotraOption.id), text: gotraOption.en };

  return {
    name: p.name,
    gotra,
    nakshatra: optionDraft(NAKSHATRAS, p.nakshatraId),
    rashi: optionDraft(RASHIS, p.rashiId),
    phone: "",
  };
}
