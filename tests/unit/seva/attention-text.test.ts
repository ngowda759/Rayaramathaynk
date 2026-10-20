import { attentionText, orderAttention, visibleAttention } from "@/lib/seva/dashboard/attention-text";
import type { NeedsAttentionCard } from "@/types/seva-reports";

/** Needs attention (DB §12.2): each card's words and the filtered screen it opens. */

function card(id: NeedsAttentionCard["id"], count: number, detail: NeedsAttentionCard["detail"] = {}, level?: NeedsAttentionCard["level"]): NeedsAttentionCard {
  return { id, level: level ?? (count > 0 ? "attention" : "ok"), count, detail };
}

describe("attentionText", () => {
  it("writes each attention card and links it to the right filtered screen", () => {
    const cases: { card: NeedsAttentionCard; title: string; line: RegExp; href: string | null }[] = [
      { card: card("changed_amounts", 2), title: "2 changed amounts", line: /reason/, href: "/seva/register?status=changed" },
      { card: card("changed_amounts", 1), title: "1 changed amount", line: /reason/, href: "/seva/register?status=changed" },
      {
        card: card("cancellations", 3, { after_window: 1, after_window_receipts: "C1-023-10-2026/000124" }),
        title: "3 cancellations",
        line: /1 after the cancel window: C1-023-10-2026\/000124/,
        href: "/seva/register?status=cancelled",
      },
      { card: card("cancellations", 2, { after_window: 0 }), title: "2 cancellations", line: /within the cancel window/, href: "/seva/register?status=cancelled" },
      {
        card: card("day_close_difference", 2, { short: 1, extra: 1 }, "critical"),
        title: "Day close: 1 short, 1 extra",
        line: /did not match/,
        href: "/seva/day-closes",
      },
      { card: card("day_close_difference", 0, { short: 0, extra: 0 }), title: "Day closes balanced", line: /matched/, href: "/seva/day-closes" },
      {
        card: card("day_not_closed", 2, { oldest_date: "2026-10-17" }, "critical"),
        title: "2 days not closed",
        line: /Oldest: Sat 17 Oct 2026/,
        href: "/seva/day-closes",
      },
      { card: card("waiting_to_sync", 0, { outbox: 0 }), title: "0 waiting to sync", line: /saved online/, href: "/seva/register" },
      { card: card("waiting_to_sync", 1, { outbox: 4 }), title: "1 counter waiting to sync", line: /4 receipts/, href: "/seva/register" },
      {
        card: card("number_gaps", 1, { missing_numbers: 3 }, "critical"),
        title: "1 number gap",
        line: /3 numbers missing/,
        href: "/seva/register#continuity",
      },
      {
        card: card("prasadam_pending", 9, { today: 9, past: 0, oldest_today: "14:10" }),
        title: "9 prasadam pending today",
        line: /oldest 14:10/,
        href: "/seva/register?status=prasadam_pending",
      },
      {
        card: card("prasadam_pending", 31, { today: 0, past: 31 }),
        title: "31 prasadam not collected",
        line: /31 not collected on earlier days/,
        href: "/seva/register?status=prasadam_pending",
      },
      { card: card("upi_refunds_due", 2, { amountPaise: 82_000 }), title: "2 UPI refunds due", line: /Rs 820/, href: "/seva/register?status=cancelled" },
      {
        card: card("clock_skew", 1, { max_skew_seconds: 300 }),
        title: "1 counter PC clock is off",
        line: /5 minutes/,
        href: "/seva/settings/counters",
      },
      { card: card("backup", 1, { reason: "failed" }, "critical"), title: "Backup needs a look", line: /failed/, href: null },
      { card: card("database_size", 1, { mb: 420 }), title: "Database 420 MB of 500 MB", line: /400 MB/, href: null },
      { card: card("in_doubt_duplicates", 1), title: "1 possible duplicate receipt", line: /offline/, href: "/seva/register" },
      { card: card("future_offline", 2), title: "2 offline receipts with a future time", line: /clock/, href: "/seva/settings/counters" },
      { card: card("offline_cancels", 3, { flagged: 1 }), title: "3 offline cancels", line: /1 sent late or by someone else/, href: "/seva/register?status=cancelled" },
      {
        card: card("upi_changed", 1, { from_vpa: "tem***@sbi", to_vpa: "mat***@sbi", changed_at: "2026-10-16T05:30:00Z", window_days: 30 }),
        title: "Counter UPI id changed",
        line: /tem\*\*\*@sbi -> mat\*\*\*@sbi on Fri 16 Oct 2026/,
        href: "/seva/settings/counters",
      },
      {
        card: card("unprinted_online", 2, { receipts: "C1-023-10-2026/000124, C1-023-10-2026/000125", oldest_at: "2026-10-20T04:30:00Z" }),
        title: "2 online receipts not printed",
        line: /C1-023-10-2026\/000124, C1-023-10-2026\/000125: no print 10 minutes after saving.*reprint or cancel/,
        href: "/seva/register",
      },
      { card: card("unprinted_online", 0), title: "0 online receipts not printed", line: /Every online receipt of today was printed/, href: "/seva/register" },
      {
        card: card("sync_refused", 2, { receipts: "OF1-023-10-2026/000004, OF1-023-10-2026/000009", amountPaise: 21_000 }, "critical"),
        title: "2 offline items refused by the office",
        line: /OF1-023-10-2026\/000004, OF1-023-10-2026\/000009: printed on a counter PC \(Rs 210\) but not in the register.*paper book.*sets them aside/,
        href: "/seva/counter",
      },
      { card: card("sync_refused", 0), title: "0 offline items refused by the office", line: /refused nothing/, href: "/seva/counter" },
    ];

    for (const c of cases) {
      const text = attentionText(c.card);
      expect({ id: c.card.id, title: text.title }).toEqual({ id: c.card.id, title: c.title });
      expect(text.line).toMatch(c.line);
      expect(text.href).toBe(c.href);
      expect(text.titleKn.length).toBeGreaterThan(0);
    }
  });

  it("puts critical cards first and hides calm extras, keeping the five core cards", () => {
    const cards = [
      card("changed_amounts", 0),
      card("cancellations", 2),
      card("day_close_difference", 0, { short: 0, extra: 0 }),
      card("day_not_closed", 1, { oldest_date: "2026-10-17" }, "critical"),
      card("waiting_to_sync", 0, { outbox: 0 }),
      card("number_gaps", 0, { missing_numbers: 0 }),
      card("prasadam_pending", 0, { today: 0, past: 0 }),
      card("database_size", 0, { mb: 12 }),
    ];
    const shown = orderAttention(visibleAttention(cards)).map((c) => c.id);
    expect(shown).toEqual(["day_not_closed", "cancellations", "changed_amounts", "day_close_difference", "waiting_to_sync", "prasadam_pending"]);
  });
});
