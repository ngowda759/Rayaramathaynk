/**
 * @jest-environment node
 */
/**
 * A5-FIX F5: the dashboard reads the new Needs attention cards from seva_needs_attention (lib/seva/server/reports.ts).
 * An id the reader does not know is an internal error, so every new SQL card must be known here.
 */
import { fromSqlAttention } from "@/lib/seva/server/reports";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

describe("fromSqlAttention (F5 cards)", () => {
  it("reads unprinted_online with its receipt numbers and oldest time", () => {
    const [card] = fromSqlAttention([
      {
        id: "unprinted_online",
        level: "attention",
        count: 2,
        detail: { receipts: "C1-023-10-2026/000124, C1-023-10-2026/000125", oldest_at: "2026-10-20T10:00:00+05:30" },
      },
    ]);
    expect(card).toEqual({
      id: "unprinted_online",
      level: "attention",
      count: 2,
      detail: { receipts: "C1-023-10-2026/000124, C1-023-10-2026/000125", oldest_at: "2026-10-20T10:00:00+05:30" },
    });
  });
});
