/**
 * Needs attention cards in words (DB §12.2): a title with the number, the Kannada name under it, one plain line, and
 * the screen that shows the receipts behind the card (the register filters read `?status=`, plan Wave A4 header).
 * `href` is null for cards that are text only (backup, database size).
 */
import { formatRupees } from "@/lib/seva/money";
import { ATTENTION_KN } from "@/lib/seva/strings/dashboard";
import { businessDate, formatSevaDate } from "@/lib/seva/time";
import type { NeedsAttentionCard, NeedsAttentionId } from "@/types/seva-reports";
import { SEVA_ROUTES } from "@/lib/seva/routes";

export interface AttentionText {
  title: string;
  titleKn: string;
  line: string;
  href: string | null;
}

const REGISTER = SEVA_ROUTES.register;
const DAY_CLOSES = SEVA_ROUTES.dayCloses;
const COUNTERS = SEVA_ROUTES.settingsCounters;

/** The five cards the dashboard always shows, even with nothing to report (mockup `home`, a calm "0" line). */
export const CORE_ATTENTION: readonly NeedsAttentionId[] = [
  "changed_amounts",
  "cancellations",
  "day_close_difference",
  "waiting_to_sync",
  "prasadam_pending",
];

const LEVEL_ORDER: Record<NeedsAttentionCard["level"], number> = { critical: 0, attention: 1, ok: 2 };

function num(detail: NeedsAttentionCard["detail"], key: string): number {
  const v = detail[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return 0;
}

function text(detail: NeedsAttentionCard["detail"], key: string): string | null {
  const v = detail[key];
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

/** '1 changed amount', '2 changed amounts'. */
function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
}

/** A 'YYYY-MM-DD' or ISO time as 'Sat 17 Oct 2026' (IST). */
function day(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatSevaDate(value);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : formatSevaDate(businessDate(d));
}

function words(card: NeedsAttentionCard): { title: string; line: string; href: string | null } {
  const n = card.count;
  const d = card.detail;
  switch (card.id) {
    case "changed_amounts":
      return {
        title: plural(n, "changed amount", "changed amounts"),
        line: n > 0 ? "Amount changed at the counter, each with a reason" : "No amount was changed in this period",
        href: `${REGISTER}?status=changed`,
      };
    case "cancellations": {
      const late = num(d, "after_window");
      const lateList = text(d, "after_window_receipts");
      let line = "No receipt was cancelled in this period";
      if (late > 0) line = `${late} after the cancel window${lateList ? `: ${lateList}` : ""}`;
      else if (n > 0) line = "All within the cancel window, with a reason";
      return { title: plural(n, "cancellation", "cancellations"), line, href: `${REGISTER}?status=cancelled` };
    }
    case "day_close_difference": {
      const short = num(d, "short");
      const extra = num(d, "extra");
      if (n === 0 && short === 0 && extra === 0) {
        return { title: "Day closes balanced", line: "Every close in this period matched", href: DAY_CLOSES };
      }
      const parts = [short > 0 ? `${short} short` : null, extra > 0 ? `${extra} extra` : null].filter(Boolean);
      return { title: `Day close: ${parts.join(", ")}`, line: "Cash or UPI did not match at close; each has a note", href: DAY_CLOSES };
    }
    case "day_not_closed": {
      const oldest = text(d, "oldest_date");
      return {
        title: plural(n, "day not closed", "days not closed"),
        line: n > 0 ? `A counter has receipts and no close.${oldest ? ` Oldest: ${day(oldest)}` : ""}` : "Every earlier day is closed",
        href: DAY_CLOSES,
      };
    }
    case "waiting_to_sync": {
      const outbox = num(d, "outbox");
      let line = "Every counter receipt is saved online";
      if (outbox > 0) line = `${plural(outbox, "receipt", "receipts")} on counter PCs not yet saved online`;
      else if (n > 0) line = "A counter PC has not been seen for 10 minutes";
      return { title: n === 0 ? "0 waiting to sync" : `${plural(n, "counter", "counters")} waiting to sync`, line, href: REGISTER };
    }
    case "number_gaps": {
      const missing = num(d, "missing_numbers");
      return {
        title: plural(n, "number gap", "number gaps"),
        line: n > 0 ? `${plural(missing, "number", "numbers")} missing; explain each in the register` : "No gaps in receipt numbers",
        href: `${REGISTER}#continuity`,
      };
    }
    case "prasadam_pending": {
      const today = num(d, "today");
      const past = num(d, "past");
      const oldest = text(d, "oldest_today");
      const title =
        today > 0 || past === 0 ? `${today.toLocaleString("en-IN")} prasadam pending today` : `${past.toLocaleString("en-IN")} prasadam not collected`;
      const parts: string[] = [];
      if (today > 0) parts.push(`Seva done, not handed over${oldest ? ` · oldest ${oldest}` : ""}`);
      if (past > 0) parts.push(`${past.toLocaleString("en-IN")} not collected on earlier days`);
      return { title, line: parts.length > 0 ? parts.join(" · ") : "Every prasadam due today is handed over", href: `${REGISTER}?status=prasadam_pending` };
    }
    case "upi_refunds_due": {
      const amount = num(d, "amountPaise");
      return {
        title: plural(n, "UPI refund due", "UPI refunds due"),
        line: n > 0 ? `${formatRupees(amount, { decimals: amount % 100 !== 0 })} to refund from the bank app` : "No UPI refund is due",
        href: `${REGISTER}?status=cancelled`,
      };
    }
    case "clock_skew": {
      const minutes = Math.max(1, Math.round(num(d, "max_skew_seconds") / 60));
      return {
        title: n === 1 ? "1 counter PC clock is off" : `${plural(n, "counter PC clock", "counter PC clocks")} off`,
        line: n > 0 ? `Up to ${plural(minutes, "minute", "minutes")} off; set the PC time` : "Every counter PC clock is right",
        href: COUNTERS,
      };
    }
    case "backup": {
      const reason = text(d, "reason");
      const line =
        reason === "never"
          ? "No nightly backup has run yet"
          : reason === "failed"
            ? "Last night's backup failed"
            : reason === "stale"
              ? "The last good backup is more than 36 hours old"
              : "The nightly backup is up to date";
      return { title: reason ? "Backup needs a look" : "Backup up to date", line, href: null };
    }
    case "database_size": {
      const mb = num(d, "mb");
      return {
        title: `Database ${mb.toLocaleString("en-IN")} MB of 500 MB`,
        line: card.level === "ok" ? "Well within the free plan" : "Above 400 MB; plan an archive before it fills",
        href: null,
      };
    }
    case "in_doubt_duplicates":
      return {
        title: plural(n, "possible duplicate receipt", "possible duplicate receipts"),
        line: "An offline receipt was printed for an order the office had already saved; cancel one",
        href: REGISTER,
      };
    case "future_offline":
      return {
        title: plural(n, "offline receipt with a future time", "offline receipts with a future time"),
        line: "A counter PC clock ran fast while offline",
        href: COUNTERS,
      };
    case "offline_cancels": {
      const flagged = num(d, "flagged");
      return {
        title: plural(n, "offline cancel", "offline cancels"),
        line: flagged > 0 ? `${flagged} sent late or by someone else; check them` : "All sent in time by the person who cancelled",
        href: `${REGISTER}?status=cancelled`,
      };
    }
    case "upi_changed": {
      const from = text(d, "from_vpa");
      const to = text(d, "to_vpa");
      const at = text(d, "changed_at");
      const change = from || to ? `${from ?? "none"} -> ${to ?? "none"}` : "Payee changed";
      return {
        title: n > 1 ? `Counter UPI id changed ${n} times` : "Counter UPI id changed",
        line: `${change}${at ? ` on ${day(at)}` : ""}. Check it is the temple's account`,
        href: COUNTERS,
      };
    }
    case "synced_into_closed_day": {
      const amount = num(d, "amountPaise");
      const oldest = text(d, "oldest_date");
      return {
        title: plural(n, "offline receipt after day close", "offline receipts after day close"),
        line:
          n > 0
            ? `${formatRupees(amount, { decimals: amount % 100 !== 0 })} reached the office after the day was closed${
                oldest ? ` (from ${day(oldest)})` : ""
              }; reopen that day and close it again`
            : "No offline receipt arrived after its day was closed",
        href: DAY_CLOSES,
      };
    }
    case "unprinted_online": {
      const receipts = text(d, "receipts");
      return {
        title: plural(n, "online receipt not printed", "online receipts not printed"),
        line:
          n > 0
            ? `${receipts ?? "Some receipts"}: no print 10 minutes after saving. Ask the counter whether the slip came out; reprint or cancel it from Today's receipts`
            : "Every online receipt of today was printed",
        href: REGISTER,
      };
    }
    case "sync_refused": {
      const receipts = text(d, "receipts");
      const amount = num(d, "amountPaise");
      return {
        title: plural(n, "offline item refused by the office", "offline items refused by the office"),
        line:
          n > 0
            ? `${receipts ? `${receipts}: ` : ""}printed on a counter PC${
                amount > 0 ? ` (${formatRupees(amount, { decimals: amount % 100 !== 0 })})` : ""
              } but not in the register. Write them in the paper book; then a temple admin sets them aside on that PC`
            : "The office has refused nothing a counter PC sent",
        href: SEVA_ROUTES.counter,
      };
    }
    default: {
      const unknown: never = card.id;
      return { title: String(unknown), line: "", href: null };
    }
  }
}

/** The words and link for one needs-attention card. */
export function attentionText(card: NeedsAttentionCard): AttentionText {
  const w = words(card);
  return { title: w.title, titleKn: ATTENTION_KN[card.id] ?? "", line: w.line, href: w.href };
}

/** The cards to show: the five core cards always, every other card only when it has something to report. */
export function visibleAttention(cards: NeedsAttentionCard[]): NeedsAttentionCard[] {
  return cards.filter((c) => c.level !== "ok" || CORE_ATTENTION.includes(c.id));
}

/** Critical first, then attention, then calm cards; the server's order within each level. */
export function orderAttention(cards: NeedsAttentionCard[]): NeedsAttentionCard[] {
  return cards
    .map((card, i) => ({ card, i }))
    .sort((a, b) => LEVEL_ORDER[a.card.level] - LEVEL_ORDER[b.card.level] || a.i - b.i)
    .map((x) => x.card);
}
