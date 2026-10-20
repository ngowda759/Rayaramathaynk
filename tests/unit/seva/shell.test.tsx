import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { can as matrixCan, SEVA_ACTIONS } from "@/lib/seva/permissions";
import { businessDate } from "@/lib/seva/time";
import type { SevaMe, SevaRole } from "@/types/seva";

/* ---------- mocks ---------- */

type AuthValue = Record<string, unknown>;
let mockAuth: AuthValue = {};
type SevaMeHook = typeof import("@/hooks/seva/useSevaMe").useSevaMe;
let mockSevaMe: ReturnType<SevaMeHook> | null = null;
const mockSevaFetch = jest.fn();
const mockGetProfile = jest.fn();
let mockFirebaseUser: { uid: string } | null = null;

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span data-alt={alt} />,
}));

jest.mock("framer-motion", () => {
  const strip = ({ children, className }: { children?: ReactNode; className?: string }) => ({ children, className });
  return {
    motion: {
      div: (p: { children?: ReactNode; className?: string }) => <div {...strip(p)} />,
      aside: (p: { children?: ReactNode; className?: string }) => <aside {...strip(p)} />,
      button: (p: { children?: ReactNode; className?: string }) => <button type="button" {...strip(p)} />,
    },
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  };
});

jest.mock("@/lib/firebase", () => ({
  auth: {},
  db: null,
  isFirebaseConfigured: false,
  initializeAuthPersistence: () => Promise.resolve(),
  getFirebaseConfigStatus: () => ({ isValid: true, missingFields: [] }),
}));

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb(mockFirebaseUser);
    return () => undefined;
  },
}));

jest.mock("@/services/auth.service", () => ({
  authService: { getUserProfile: (...args: unknown[]) => mockGetProfile(...args) },
}));

// The sidebar, guard and hook read auth through useAuthContext; AuthProvider itself stays real.
jest.mock("@/context/AuthContext", () => {
  const actual = jest.requireActual("@/context/AuthContext");
  return { ...actual, useAuthContext: () => mockAuth };
});

jest.mock("@/hooks/seva/useSevaMe", () => {
  const actual = jest.requireActual("@/hooks/seva/useSevaMe");
  return {
    ...actual,
    useSevaMe: (...args: Parameters<SevaMeHook>) => mockSevaMe ?? actual.useSevaMe(...args),
  };
});

jest.mock("@/services/seva/http", () => {
  const actual = jest.requireActual("@/services/seva/http");
  return { ...actual, sevaFetch: (...args: unknown[]) => mockSevaFetch(...args) };
});

jest.mock("@/components/admin/layout/NotificationDropdown", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/lib/seva/offline/db", () => ({
  openSevaDb: () => Promise.reject(new Error("no IndexedDB in jsdom")),
}));

/* ---------- helpers ---------- */

function meOf(role: SevaRole, viewOnly = false, counterId: number | null = null): SevaMe {
  return {
    staffId: `staff-${role}`,
    staffNo: 23,
    name: "Ramesh",
    role,
    viewOnly,
    actions: [],
    counter: counterId === null ? null : { id: counterId, name: "Counter 1", onlineSeries: "C1", offlineSeries: "OF1" },
  };
}

function fakeHook(me: SevaMe | null): ReturnType<SevaMeHook> {
  return {
    me,
    loading: false,
    error: null,
    // Same as the real hook: the device's counter and today's IST date are filled in, never taken from the caller.
    can: (action, ctx) =>
      me
        ? matrixCan(me, action, { ...ctx, counterIdOfDevice: me.counter?.id, todayBusinessDate: businessDate(new Date()) })
        : false,
    reload: () => Promise.resolve(),
  };
}

function signedIn(sevaRole: SevaRole | null, extra: AuthValue = {}): AuthValue {
  return {
    user: { uid: `uid-${sevaRole ?? "none"}-${Math.random()}`, getIdToken: () => Promise.resolve("id-token") },
    profile: null,
    loading: false,
    sevaRole,
    canAccessAdmin: true,
    canAccessAdministration: false,
    canAccessSettings: false,
    canAccessFinance: false,
    canManageUsers: false,
    ...extra,
  };
}

async function sidebarHrefs(): Promise<string[]> {
  const AdminSidebar = (await import("@/components/admin/layout/AdminSidebar")).default;
  const { container } = render(<AdminSidebar isOpen={false} onClose={() => undefined} />);
  await waitFor(() => expect(container.querySelectorAll("aside a").length).toBeGreaterThan(0));
  return Array.from(container.querySelectorAll("aside a")).map((a) => a.getAttribute("href") ?? "");
}

// The website admin has one Seva Entry item (plan A4S-3); the module's own pages live in its rail at /seva.
const SEVA_HREFS = ["/seva"];

/** Old Receipt Book and Prasadam addresses that must no longer appear in the website sidebar. */
const OLD_SEVA_HREFS = [
  "/admin/receipts",
  "/admin/receipts/counter",
  "/admin/receipts/counter/today",
  "/admin/receipts/day-close",
  "/admin/receipts/register",
  "/admin/receipts/reports",
  "/admin/receipts/day-closes",
  "/admin/receipts/seva-settings",
  "/admin/receipts/settings",
  "/admin/prasadam",
];

beforeEach(() => {
  mockAuth = {};
  mockSevaMe = null;
  mockFirebaseUser = null;
  mockSevaFetch.mockReset();
  mockGetProfile.mockReset();
  mockPush.mockReset();
});

/* ---------- navigation per role ---------- */

describe("admin sidebar per seva role", () => {
  it("shows a receptionist and a prasadam volunteer only the one Seva Entry item", async () => {
    mockAuth = signedIn("receptionist");
    mockSevaMe = fakeHook(meOf("receptionist", false, 1));
    expect(await sidebarHrefs()).toEqual(["/seva"]);
    // Kannada on its own line under the English label.
    expect(screen.getAllByText("Seva Entry").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ಸೇವಾ ನಮೂದು")[0]).toHaveAttribute("lang", "kn");
    // One item, no sub-items.
    expect(document.querySelector('aside [role="group"]')).toBeNull();
    cleanup();

    mockAuth = signedIn("prasadam_counter");
    mockSevaMe = fakeHook(meOf("prasadam_counter"));
    expect(await sidebarHrefs()).toEqual(["/seva"]);
    expect(document.querySelector('aside [role="group"]')).toBeNull();
  });

  it("gives a temple admin and a super admin one Seva Entry item in Finance, with no Receipt Book sub-items", async () => {
    const cases: [string, () => void][] = [
      ["temple admin", () => { mockAuth = signedIn("temple_admin"); mockSevaMe = fakeHook(meOf("temple_admin", false)); }],
      ["view-only temple admin", () => { mockAuth = signedIn("temple_admin"); mockSevaMe = fakeHook(meOf("temple_admin", true)); }],
      ["temple admin, profile loading", () => { mockAuth = signedIn("temple_admin"); mockSevaMe = { ...fakeHook(null), loading: true }; }],
      ["super admin", () => { mockAuth = signedIn("super_admin", { canAccessAdministration: true }); mockSevaMe = fakeHook(meOf("super_admin")); }],
    ];
    for (const [name, arrange] of cases) {
      arrange();
      const hrefs = await sidebarHrefs();
      expect([name, hrefs.filter((h) => h === "/seva")]).toEqual([name, ["/seva"]]);
      // The item keeps Receipt Book's place in Finance, between Billing and Bookings.
      expect(hrefs.indexOf("/admin/billing")).toBeLessThan(hrefs.indexOf("/seva"));
      expect(hrefs.indexOf("/seva")).toBeLessThan(hrefs.indexOf("/admin/bookings"));
      for (const href of OLD_SEVA_HREFS) expect([name, hrefs.includes(href)]).toEqual([name, false]);
      expect(document.querySelector('aside [role="group"]')).toBeNull();
      expect(screen.queryByText("Receipt Book")).toBeNull();
      cleanup();
    }
    // Staff lives in the module rail now: a temple admin without Administration gets no Users link here.
    mockAuth = signedIn("temple_admin");
    mockSevaMe = fakeHook(meOf("temple_admin", false));
    expect(await sidebarHrefs()).not.toContain("/admin/users");
  });

  it("keeps the existing sections for an existing billing user", async () => {
    mockAuth = signedIn(null, { normalizedRole: "billing" });
    mockSevaMe = fakeHook(null);
    expect(await sidebarHrefs()).toEqual([
      "/admin",
      "/admin/events",
      "/admin/sevas",
      "/admin/aaradhane",
      "/admin/billing",
      "/seva",
      "/admin/bookings",
      "/admin/pooja",
      "/admin/donations",
      "/admin/reports",
      "/admin/gallery",
      "/admin/announcements",
      "/admin/testimonials",
      "/admin/settings/about",
      "/admin/settings/facilities",
      "/admin/settings/guru-parampara",
      "/admin/settings/shlokas",
      "/admin/settings/footer",
      "/admin/settings/social-links",
      "/admin/settings/puja-schedule",
      "/admin/settings/future-plans",
      "/admin/settings/ekadashi-calendar",
      "/admin/settings/festival-calendar",
      "/admin/ai",
      "/admin/ai/settings",
      "/admin/ai/prompts",
      "/admin/knowledge",
      "/admin/ai/intents",
      "/admin/ai/unknown-questions",
      "/admin/ai/analytics",
      "/admin/ai/health",
    ]);
  });

  it("keeps the Administration section for a super admin", async () => {
    mockAuth = signedIn("super_admin", { canAccessAdministration: true });
    mockSevaMe = fakeHook(meOf("super_admin"));
    const hrefs = await sidebarHrefs();
    for (const href of SEVA_HREFS) expect(hrefs).toContain(href);
    // Staff and roles is the existing Users page; a super admin reaches it once, under Administration.
    expect(hrefs.filter((h) => h === "/admin/users")).toHaveLength(1);
    expect(hrefs).toContain("/admin/temple-areas");
  });
});

/* ---------- gate ---------- */

describe("SevaGate", () => {
  it("SevaGate hides a page the person may not use", async () => {
    const { SevaGate } = await import("@/components/seva/shell/SevaGate");
    mockSevaMe = fakeHook(meOf("prasadam_counter"));
    const { unmount } = render(
      <SevaGate action="reports.view">
        <p>Reports body</p>
      </SevaGate>,
    );
    expect(screen.queryByText("Reports body")).toBeNull();
    expect(screen.getByText("You do not have access to this page.")).toBeInTheDocument();
    expect(screen.getByText("ಈ ಪುಟವನ್ನು ತೆರೆಯಲು ನಿಮಗೆ ಅನುಮತಿ ಇಲ್ಲ.")).toHaveAttribute("lang", "kn");
    unmount();

    mockSevaMe = fakeHook(meOf("temple_admin", true));
    render(
      <SevaGate action="reports.view">
        <p>Reports body</p>
      </SevaGate>,
    );
    expect(screen.getByText("Reports body")).toBeInTheDocument();
  });

  it("lets a receptionist open own-counter pages such as Close day, and nobody without a seva role", async () => {
    const { SevaGate } = await import("@/components/seva/shell/SevaGate");
    mockSevaMe = fakeHook(meOf("receptionist", false, 1));
    const { unmount } = render(
      <SevaGate action="dayclose.close">
        <p>Close day body</p>
      </SevaGate>,
    );
    expect(screen.getByText("Close day body")).toBeInTheDocument();
    unmount();

    mockSevaMe = fakeHook(null);
    render(
      <SevaGate action="me">
        <p>Anything</p>
      </SevaGate>,
    );
    expect(screen.queryByText("Anything")).toBeNull();
    expect(screen.getByText("You do not have access to this page.")).toBeInTheDocument();
  });
});

/* ---------- useSevaMe ---------- */

describe("useSevaMe", () => {
  type Hook = ReturnType<SevaMeHook>;
  let captured: Hook | null = null;

  async function mountProvider(): Promise<void> {
    const actual = jest.requireActual("@/hooks/seva/useSevaMe") as typeof import("@/hooks/seva/useSevaMe");
    function Probe() {
      captured = actual.useSevaMe();
      return <span>{captured.loading ? "loading" : captured.me ? captured.me.role : "none"}</span>;
    }
    render(
      <actual.SevaMeProvider>
        <Probe />
      </actual.SevaMeProvider>,
    );
    await waitFor(() => expect(captured?.loading).toBe(false));
  }

  it("useSevaMe.can follows the permission matrix", async () => {
    const today = businessDate(new Date());
    for (const me of [meOf("receptionist", false, 4), meOf("prasadam_counter"), meOf("temple_admin", true), meOf("super_admin")]) {
      mockAuth = signedIn(me.role);
      mockSevaFetch.mockResolvedValueOnce(me);
      captured = null;
      await mountProvider();
      expect(captured!.me).toEqual(me);
      for (const action of SEVA_ACTIONS) {
        expect([action, captured!.can(action)]).toEqual([
          action,
          matrixCan(me, action, { counterIdOfDevice: me.counter?.id, todayBusinessDate: today }),
        ]);
      }
      cleanup();
    }
    expect(mockSevaFetch).toHaveBeenCalledWith("/api/seva/me", expect.objectContaining({ token: "id-token", deviceHeader: null }));

    // A receptionist reprints only on the device's own counter, today.
    mockAuth = signedIn("receptionist");
    mockSevaFetch.mockResolvedValueOnce(meOf("receptionist", false, 4));
    await mountProvider();
    expect(captured!.can("receipt.reprint", { receiptCounterId: 4, receiptBusinessDate: today })).toBe(true);
    expect(captured!.can("receipt.reprint", { receiptCounterId: 5, receiptBusinessDate: today })).toBe(false);
    // The device's counter comes from the server, never from the caller.
    expect(captured!.can("receipt.reprint", { counterIdOfDevice: 5, receiptCounterId: 5, receiptBusinessDate: today })).toBe(false);
  });

  it("does not call the seva API for a user without a seva role and allows nothing", async () => {
    mockAuth = signedIn(null);
    await mountProvider();
    expect(mockSevaFetch).not.toHaveBeenCalled();
    expect(captured!.me).toBeNull();
    expect(captured!.error).toBeNull();
    expect(captured!.can("me")).toBe(false);
  });

  it("treats a refused profile as no access and a failed call as an error that can be retried", async () => {
    const { SevaClientError } = jest.requireActual("@/services/seva/http") as typeof import("@/services/seva/http");
    mockAuth = signedIn("receptionist");
    mockSevaFetch.mockRejectedValueOnce(new SevaClientError("staff_inactive", 403, "Your seva access is switched off."));
    await mountProvider();
    expect(captured!.me).toBeNull();
    expect(captured!.error).toBeNull();
    cleanup();

    mockAuth = signedIn("receptionist");
    mockSevaFetch.mockRejectedValueOnce(new SevaClientError("network", 0, "No connection to the office server."));
    await mountProvider();
    expect(captured!.error).toBe("No connection to the office server.");
    mockSevaFetch.mockResolvedValueOnce(meOf("receptionist"));
    await act(async () => {
      await captured!.reload();
    });
    await waitFor(() => expect(captured!.me?.role).toBe("receptionist"));
    expect(captured!.error).toBeNull();
  });
});

/* ---------- AuthContext ---------- */

describe("AuthContext", () => {
  it("AuthContext maps temple_admin and admin to temple_admin and billing to null", async () => {
    const actual = jest.requireActual("@/context/AuthContext") as typeof import("@/context/AuthContext");
    function Probe() {
      const ctx = actual.useAuthContext();
      return <span data-testid="role">{ctx.loading ? "loading" : String(ctx.sevaRole)}</span>;
    }
    const cases: [string, string][] = [
      ["temple_admin", "temple_admin"],
      ["admin", "temple_admin"],
      ["billing", "null"],
      ["receptionist", "receptionist"],
      ["prasadam_counter", "prasadam_counter"],
      ["super_admin", "super_admin"],
    ];
    for (const [stored, expected] of cases) {
      mockFirebaseUser = { uid: `u-${stored}` };
      mockGetProfile.mockResolvedValueOnce({ uid: `u-${stored}`, role: stored, isActive: true });
      const { unmount } = render(
        <actual.AuthProvider>
          <Probe />
        </actual.AuthProvider>,
      );
      await waitFor(() => expect(screen.getByTestId("role")).toHaveTextContent(expected));
      unmount();
    }
  });
});

/* ---------- route guard ---------- */

describe("AdminAuthGuard seva permissions", () => {
  it("lets only the right seva roles through and keeps the existing cases as they were", async () => {
    const AdminAuthGuard = (await import("@/components/admin/layout/AdminAuthGuard")).default;
    type Perm = Parameters<typeof AdminAuthGuard>[0]["requiredPermission"];
    const allowed = async (sevaRole: SevaRole | null, permission: Perm): Promise<boolean> => {
      mockAuth = signedIn(sevaRole);
      mockReplace.mockClear();
      const { unmount } = render(
        <AdminAuthGuard requiredPermission={permission}>
          <p>inside</p>
        </AdminAuthGuard>,
      );
      // Allowed: the children show. Refused: the guard keeps its spinner and sends the person home.
      await waitFor(() => expect(screen.queryByText("inside") !== null || mockReplace.mock.calls.length > 0).toBe(true));
      const ok = screen.queryByText("inside") !== null;
      if (!ok) expect(mockReplace).toHaveBeenCalledWith("/");
      unmount();
      return ok;
    };
    expect(await allowed("receptionist", "sevaCounter")).toBe(true);
    expect(await allowed("prasadam_counter", "sevaCounter")).toBe(false);
    expect(await allowed("prasadam_counter", "sevaPrasadam")).toBe(true);
    expect(await allowed("receptionist", "sevaPrasadam")).toBe(false);
    expect(await allowed("temple_admin", "sevaAdmin")).toBe(true);
    expect(await allowed("receptionist", "sevaAdmin")).toBe(false);
    expect(await allowed(null, "sevaCounter")).toBe(false);
    // Existing cases unchanged: anyone who can open the admin console passes "billing".
    expect(await allowed(null, "billing")).toBe(true);
  });
});

/* ---------- landing ---------- */

describe("role landing", () => {
  it("names the counter for a receptionist, the prasadam page for a volunteer and nothing for others", async () => {
    const { sevaLandingPath } = await import("@/components/admin/layout/navigation");
    expect(sevaLandingPath("receptionist")).toBe("/seva/counter");
    expect(sevaLandingPath("prasadam_counter")).toBe("/seva/prasadam");
    expect(sevaLandingPath("temple_admin")).toBeNull();
    expect(sevaLandingPath("super_admin")).toBeNull();
    expect(sevaLandingPath(null)).toBeNull();
  });
});

/* ---------- header search ---------- */

describe("admin header search", () => {
  it("header search for receipt, prasadam or seva entry opens /seva, and seva still opens /admin/sevas", async () => {
    const AdminHeader = (await import("@/components/admin/layout/AdminHeader")).default;
    mockAuth = { ...signedIn("temple_admin"), normalizedRole: "admin", logout: () => Promise.resolve() };
    render(<AdminHeader onMenuClick={() => undefined} />);
    const input = screen.getByPlaceholderText("Search pages... (⌘K)");
    const search = (q: string): unknown => {
      mockPush.mockClear();
      fireEvent.change(input, { target: { value: q } });
      fireEvent.submit(input.closest("form")!);
      return mockPush.mock.calls.at(-1)?.[0];
    };
    expect(search("receipt")).toBe("/seva");
    expect(search("Receipts")).toBe("/seva");
    expect(search("prasadam")).toBe("/seva");
    expect(search("Seva Entry")).toBe("/seva");
    expect(search("seva")).toBe("/admin/sevas");
    expect(search("sevas")).toBe("/admin/sevas");
    expect(search("booking")).toBe("/admin/bookings");
  });
});
