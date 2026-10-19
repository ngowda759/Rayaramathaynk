import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PrintedPanel } from "@/components/seva/counter/PrintedPanel";
import { RegisterPrompt } from "@/components/seva/counter/RegisterPrompt";
import { StatusStrip } from "@/components/seva/counter/StatusStrip";
import { NeedsAttention } from "@/components/seva/dashboard/NeedsAttention";
import { SummaryTiles } from "@/components/seva/dashboard/SummaryTiles";
import { CashCount } from "@/components/seva/dayclose/CashCount";
import { ExportForm } from "@/components/seva/export/ExportForm";
import { PrasadamShortcut } from "@/components/seva/receipt/PrasadamShortcut";
import { ReceiptDrawer } from "@/components/seva/register/ReceiptDrawer";
import { AuditTrail } from "@/components/seva/reports/AuditTrail";
import type { IssuedReceipt } from "@/types/seva";
import type { ReceiptListItem } from "@/types/seva-receipts";
import type { NeedsAttentionCard } from "@/types/seva-reports";

/** Every link a seva component makes points under /seva (plan A4S-5); the addresses are written out so the test pins them. */

jest.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { getIdToken: async (): Promise<string> => "token" } }) }));
jest.mock("@/hooks/seva/useSevaMe", () => ({
  useSevaMe: () => ({ me: { name: "Suresh", staffNo: 7 }, can: () => true }),
}));
jest.mock("@/services/seva/reports.service", () => ({ reportsApi: () => ({ export: jest.fn(), exportAudit: jest.fn() }) }));
jest.mock("@/services/seva/settings.service", () => ({
  settingsApi: () => ({ getRules: async () => Promise.reject(new Error("not allowed")) }),
}));

const TOKEN = "AbCdEfGhIjKlMnOpQrStUv";

const RECEIPT: IssuedReceipt = {
  id: "r1",
  clientReceiptId: "c1",
  receiptNo: "C1-023-10-2026/000124",
  seriesCode: "C1",
  sevaDate: "2026-10-18",
  groupNo: "G1",
  position: 1,
  count: 1,
  orderTotalPaise: 15_000,
  totalPaise: 15_000,
  lines: [],
  payment: { mode: "cash" },
  devotee: { name: "Ramesh" },
  qrToken: TOKEN,
  issuedAt: "2026-10-18T05:30:00Z",
  issuedBy: { name: "Suresh", staffNo: 23 },
};

const ROW = {
  id: "r 1",
  receiptNo: RECEIPT.receiptNo,
  series: "C1",
  businessDate: "2026-10-18",
  issuedAt: "2026-10-18T05:30:00Z",
  devoteeName: "Ramesh",
  sevas: "Archane",
  totalPaise: 15_000,
  mode: "cash",
  status: "issued",
  changed: false,
  printCount: 1,
  prasadam: "none",
  groupNo: "G1",
  position: 1,
  count: 1,
  issuedByStaffId: null,
  cancelDeadline: null,
  refundState: "none",
} as unknown as ReceiptListItem;

function card(id: NeedsAttentionCard["id"], detail: NeedsAttentionCard["detail"] = {}): NeedsAttentionCard {
  return { id, level: "attention", count: 1, detail };
}

function hrefs(): string[] {
  return screen.getAllByRole("link").map((a) => a.getAttribute("href") ?? "");
}

afterEach(cleanup);

describe("seva component links", () => {
  it("every seva component link points under /seva", () => {
    render(<PrintedPanel receipts={[RECEIPT]} offline={false} />);
    expect(hrefs()).toContain("/seva/counter/today");
    cleanup();

    render(<RegisterPrompt canRegister />);
    expect(hrefs()).toEqual(["/seva/settings/counters"]);
    cleanup();

    render(
      <StatusStrip
        counterName="Counter 1"
        staffLabel="Suresh - 023"
        connection={{ status: "online", forced: false, waiting: 0 } as never}
        nextNumber="000125"
        today={{ receipts: 1, cashPaise: 100, upiPaise: 0 }}
        skewMs={0}
        dayClosed={false}
        onForcedOffline={() => undefined}
      />,
    );
    expect(hrefs()).toEqual(["/seva/day-close"]);
    cleanup();

    render(<NeedsAttention cards={[card("day_close_difference", { short: 1, extra: 0 }), card("clock_skew", { max_skew_seconds: 300 })]} />);
    expect(hrefs()).toEqual(["/seva/day-closes", "/seva/settings/counters"]);
    expect(screen.getByText(/Open day closes/)).toBeInTheDocument();
    expect(screen.getByText(/Open counter settings/)).toBeInTheDocument();
    cleanup();

    render(
      <SummaryTiles
        period="today"
        tiles={{ totalPaise: 1, receipts: 1, cashPaise: 1, upiPaise: 1, onlinePaise: 0, prev: null }}
      />,
    );
    expect(hrefs()).toEqual(["/seva/reports", "/seva/register", "/seva/day-closes", "/seva/day-closes"]);
    cleanup();

    render(
      <CashCount
        denominations={[{ kind: "note", valuePaise: 50_000 }]}
        expectedPaise={0}
        counts={{}}
        onCountChange={() => undefined}
        note=""
        onNoteChange={() => undefined}
        canManageDenominations
      />,
    );
    expect(hrefs()).toEqual(["/seva/settings/denominations"]);
    cleanup();

    render(<ExportForm />);
    expect(hrefs()).toEqual(["/seva/reports", "/seva/reports"]);
    cleanup();

    render(<PrasadamShortcut token={TOKEN} />);
    expect(hrefs()).toEqual([`/seva/prasadam?token=${TOKEN}`]);
    cleanup();

    render(<ReceiptDrawer row={ROW} today="2026-10-18" load={() => new Promise(() => undefined)} onClose={() => undefined} />);
    expect(hrefs()).toContain("/seva/r%201");
    cleanup();

    render(
      <AuditTrail
        entries={[
          { id: 1, at: "2026-10-18T05:30:00Z", action: "receipt.cancel", entity: "receipt", entityId: "r 1", receiptNo: null, reason: null, by: null, before: null, after: null },
          { id: 2, at: "2026-10-18T06:30:00Z", action: "dayclose.close", entity: "day_close", entityId: "d1", receiptNo: null, reason: null, by: null, before: null, after: null },
        ]}
        type="all"
        onType={() => undefined}
        person=""
        people={[]}
        onPerson={() => undefined}
        hasMore={false}
        loadingMore={false}
        onMore={() => undefined}
      />,
    );
    expect(hrefs()).toEqual(expect.arrayContaining(["/seva/r%201", "/seva/day-closes"]));
  });

  it("Print summary opens /seva/reports/summary with the range", () => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    render(<ExportForm />);
    fireEvent.click(screen.getByRole("radio", { name: /print/i }));
    fireEvent.click(screen.getByRole("button", { name: /print|open|download/i }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toMatch(/^\/seva\/reports\/summary\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);
    open.mockRestore();
  });
});
