import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ExportForm } from "@/components/seva/export/ExportForm";
import { EXPORT_TICKS, partsFor } from "@/lib/seva/export/collect";

/**
 * Export progress (plan A4P-3): while the data is paged out of the export API the form shows a progress bar with
 * "Part n of m", and the download button is a pending button that cannot be pressed twice.
 */

type ExportPage = { rows: unknown[]; nextCursor: string | null };

const mockUser = { getIdToken: async (): Promise<string> => "token" };
const mockMe = { name: "Suresh", staffNo: 7 };
const mockFlow = { auto: false };
const mockCalls: { part: string; cursor?: string; resolve(p: ExportPage): void }[] = [];
const mockApi = {
  export: jest.fn((p: { part: string; cursor?: string }) => {
    if (mockFlow.auto) return Promise.resolve({ rows: [], nextCursor: null });
    return new Promise<ExportPage>((resolve) => {
      mockCalls.push({ part: p.part, cursor: p.cursor, resolve });
    });
  }),
  exportAudit: jest.fn(async () => undefined),
};

jest.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("@/hooks/seva/useSevaMe", () => ({ useSevaMe: () => ({ me: mockMe, can: () => false }) }));
jest.mock("@/services/seva/reports.service", () => ({ reportsApi: () => mockApi }));
jest.mock("@/services/seva/settings.service", () => ({
  settingsApi: () => ({ getRules: async () => Promise.reject(new Error("not allowed")) }),
}));

const CSV_PARTS = partsFor("csv", [...EXPORT_TICKS]);

async function answer(i: number, p: ExportPage): Promise<void> {
  await waitFor(() => expect(mockCalls.length).toBeGreaterThan(i));
  await act(async () => {
    mockCalls[i].resolve(p);
  });
}

beforeAll(() => {
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:export") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
  // jsdom cannot follow a download link; the click itself is all the form needs.
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

beforeEach(() => {
  mockCalls.length = 0;
  mockFlow.auto = false;
  mockApi.export.mockClear();
  mockApi.exportAudit.mockClear();
});

afterEach(cleanup);

describe("export progress", () => {
  it("shows part n of m while it pages, and the button stays pending until the file is saved", async () => {
    render(<ExportForm />);
    fireEvent.click(screen.getByRole("radio", { name: /^CSV/ }));
    const button = screen.getByRole("button", { name: "Prepare CSV files" });

    fireEvent.click(button);
    // Pending in the same event as the click: spinner label, busy and disabled.
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Preparing...");

    const bar = await screen.findByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuetext", `Part 1 of ${CSV_PARTS.length}`);
    expect(screen.getByText(`Part 1 of ${CSV_PARTS.length}`)).toBeInTheDocument();

    // A second page of the same part is still part 1.
    await answer(0, { rows: [], nextCursor: "p2" });
    await waitFor(() => expect(mockCalls).toHaveLength(2));
    expect(mockCalls[1]).toMatchObject({ part: CSV_PARTS[0], cursor: "p2" });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", `Part 1 of ${CSV_PARTS.length}`);

    // The next part moves the bar on.
    await answer(1, { rows: [], nextCursor: null });
    await waitFor(() =>
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", `Part 2 of ${CSV_PARTS.length}`),
    );
    expect(mockCalls[2].part).toBe(CSV_PARTS[1]);

    // The rest answer at once; the file is saved and the button is free again.
    mockFlow.auto = true;
    await answer(2, { rows: [], nextCursor: null });
    await screen.findByText("The file is ready and saved to your downloads.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Prepare CSV files" })).not.toBeDisabled());
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(mockApi.exportAudit).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
