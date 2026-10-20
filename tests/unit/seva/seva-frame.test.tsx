import "@testing-library/jest-dom";
import fs from "node:fs";
import path from "node:path";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { can as matrixCan } from "@/lib/seva/permissions";
import { businessDate } from "@/lib/seva/time";
import type { SevaMe, SevaRole } from "@/types/seva";

/**
 * Seva Entry's own frames at /seva (plan A4S-2): the desk frame (header, section rail, phone bar) and the full-screen
 * counter frame, the guard's way back to a deep link after sign-in, and the site chat bubble kept off /seva.
 */

/* ---------- mocks ---------- */

type AuthValue = Record<string, unknown>;
let mockAuth: AuthValue = {};
type SevaMeHook = typeof import("@/hooks/seva/useSevaMe").useSevaMe;
let mockSevaMe: ReturnType<SevaMeHook> | null = null;
const mockPath = { current: "/seva", search: "" };
const mockReplace = jest.fn();
const mockSevaFetch = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockPath.current,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(mockPath.search),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span data-alt={alt} />,
}));

// A plain anchor: these tests check the frame, not Next's navigation.
jest.mock("next/link", () => ({
  __esModule: true,
  useLinkStatus: () => ({ pending: false }),
  default: ({ children, href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a
      href={href}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        e.preventDefault();
      }}
    >
      {children}
    </a>
  ),
}));

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return null;
    },
}));

jest.mock("@/components/ai/FloatingButton", () => ({ FloatingButton: () => <button type="button">Ask Raya</button> }));
jest.mock("@/components/ai/QuickQuestionIcons", () => ({ QuickQuestionIcons: () => null }));

jest.mock("@/styles/seva/tokens.css", () => ({}));
jest.mock("@/styles/seva/print.css", () => ({}));

jest.mock("@/lib/firebase", () => ({
  auth: {},
  db: null,
  isFirebaseConfigured: false,
  initializeAuthPersistence: () => Promise.resolve(),
  getFirebaseConfigStatus: () => ({ isValid: true, missingFields: [] }),
}));

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

jest.mock("@/lib/seva/offline/db", () => ({
  openSevaDb: () => Promise.reject(new Error("no IndexedDB in jsdom")),
}));

/* ---------- helpers ---------- */

const ROOT = path.resolve(__dirname, "../../..");

function meOf(
  role: SevaRole,
  opts: { viewOnly?: boolean; counter?: string | null; name?: string; staffNo?: number } = {},
): SevaMe {
  return {
    staffId: `staff-${role}`,
    staffNo: opts.staffNo ?? 23,
    name: opts.name ?? "Ramesh",
    role,
    viewOnly: opts.viewOnly ?? false,
    actions: [],
    counter: opts.counter ? { id: 1, name: opts.counter, onlineSeries: "C1", offlineSeries: "OF1" } : null,
  };
}

function fakeHook(me: SevaMe | null, extra: Partial<ReturnType<SevaMeHook>> = {}): ReturnType<SevaMeHook> {
  return {
    me,
    loading: false,
    error: null,
    can: (action, ctx) =>
      me
        ? matrixCan(me, action, { ...ctx, counterIdOfDevice: me.counter?.id, todayBusinessDate: businessDate(new Date()) })
        : false,
    reload: () => Promise.resolve(),
    ...extra,
  };
}

function signedIn(sevaRole: SevaRole | null, extra: AuthValue = {}): AuthValue {
  return {
    user: { uid: `uid-${sevaRole ?? "none"}`, getIdToken: () => Promise.resolve("id-token") },
    profile: null,
    loading: false,
    sevaRole,
    canAccessAdmin: true,
    logout: jest.fn(() => Promise.resolve()),
    ...extra,
  };
}

function as(role: SevaRole | null, me: SevaMe | null, hookExtra: Partial<ReturnType<SevaMeHook>> = {}): void {
  mockAuth = signedIn(role);
  mockSevaMe = fakeHook(me, hookExtra);
}

async function renderDesk(pathname = "/seva"): Promise<void> {
  mockPath.current = pathname;
  const { DeskFrame } = await import("@/components/seva/shell/DeskFrame");
  render(
    <DeskFrame>
      <p>page body</p>
    </DeskFrame>,
  );
}

async function renderFocus(pathname = "/seva/counter"): Promise<void> {
  mockPath.current = pathname;
  const { FocusFrame } = await import("@/components/seva/shell/FocusFrame");
  render(
    <FocusFrame>
      <p>page body</p>
    </FocusFrame>,
  );
}

const header = (): HTMLElement => document.querySelector<HTMLElement>("[data-seva-header]")!;
const rail = (): HTMLElement | null => document.querySelector<HTMLElement>("[data-seva-rail]");
const phoneBar = (): HTMLElement | null => document.querySelector<HTMLElement>("[data-seva-phonebar]");
const hrefs = (el: HTMLElement): string[] => Array.from(el.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
const signOut = (): HTMLElement => within(header()).getByRole("button", { name: /Sign out/ });

const FULL_RAIL = [
  "/seva",
  "/seva/counter",
  "/seva/prasadam",
  "/seva/register",
  "/seva/day-closes",
  "/seva/reports",
  "/seva/seva-settings",
  "/seva/settings",
  "/admin/users",
];

beforeEach(() => {
  mockAuth = {};
  mockSevaMe = null;
  mockPath.current = "/seva";
  mockPath.search = "";
  mockReplace.mockReset();
  mockSevaFetch.mockReset();
  mockSevaFetch.mockReturnValue(new Promise(() => undefined));
});

afterEach(() => cleanup());

/* ---------- desk frame ---------- */

describe("Seva Entry desk frame", () => {
  it("shows a temple admin the header with name, staff number, role, Website admin and Sign out, and the rail in order", async () => {
    as("temple_admin", meOf("temple_admin", { name: "Lakshmi", staffNo: 2 }));
    await renderDesk("/seva");
    const top = header();
    expect(top).toHaveTextContent("Sri Raghavendra Swamy Matha");
    expect(top).toHaveTextContent("Seva Entry");
    expect(top).toHaveTextContent("Lakshmi · 002");
    expect(top).toHaveTextContent("Temple admin");
    expect(within(top).getByRole("link", { name: /Website admin/ })).toHaveAttribute("href", "/admin");
    expect(signOut()).toBeInTheDocument();

    const nav = rail()!;
    expect(nav.tagName).toBe("NAV");
    expect(nav).toHaveAttribute("aria-label", "Seva Entry sections");
    expect(hrefs(nav)).toEqual(FULL_RAIL);
    // Bilingual labels; Staff leaves the module and says so.
    expect(within(nav).getByText("ಡ್ಯಾಶ್‌ಬೋರ್ಡ್")).toHaveAttribute("lang", "kn");
    expect(nav.querySelector('a[href="/admin/users"]')).toHaveAttribute("title", "Opens in the website admin");
    expect(screen.getByText("page body")).toBeInTheDocument();
  });

  it("gives a view-only temple admin no Counter, Prasadam or Staff, and assumes view-only until the seva profile loads", async () => {
    const viewOnly = ["/seva", "/seva/register", "/seva/day-closes", "/seva/reports", "/seva/seva-settings", "/seva/settings"];
    as("temple_admin", meOf("temple_admin", { viewOnly: true }));
    await renderDesk();
    expect(hrefs(rail()!)).toEqual(viewOnly);
    cleanup();

    as("temple_admin", null, { loading: true });
    await renderDesk();
    expect(hrefs(rail()!)).toEqual(viewOnly);
    // Nobody is named while the profile loads.
    expect(header()).not.toHaveTextContent("Ramesh");
    expect(header()).not.toHaveTextContent("Temple admin");
  });

  it("marks the open section with aria-current, and Register for a receipt page", async () => {
    as("temple_admin", meOf("temple_admin"));
    await renderDesk("/seva/2b1c9a3e-0000-4000-8000-000000000001");
    const nav = rail()!;
    const current = nav.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute("href", "/seva/register");
    cleanup();

    await renderDesk("/seva");
    expect(rail()!.querySelector('[aria-current="page"]')).toHaveAttribute("href", "/seva");

    const { currentSectionId } = await import("@/components/seva/shell/sections");
    expect(currentSectionId("/seva")).toBe("dashboard");
    expect(currentSectionId("/seva/counter")).toBe("counter");
    expect(currentSectionId("/seva/counter/today")).toBe("counter");
    expect(currentSectionId("/seva/day-close")).toBe("counter");
    expect(currentSectionId("/seva/day-closes")).toBe("dayCloses");
    expect(currentSectionId("/seva/settings/receipt")).toBe("settings");
    expect(currentSectionId("/seva/seva-settings")).toBe("sevaSettings");
    expect(currentSectionId("/seva/reports/audit")).toBe("reports");
    expect(currentSectionId("/seva/prasadam")).toBe("prasadam");
    expect(currentSectionId("/seva/r1/print")).toBe("register");
    expect(currentSectionId("/seva/create")).toBe("register");
    expect(currentSectionId("/sevas")).toBeNull();
    expect(currentSectionId("/admin/receipts")).toBeNull();
  });

  it("a prasadam volunteer gets no rail and no phone bar, only the header with Sign out", async () => {
    as("prasadam_counter", meOf("prasadam_counter"));
    await renderDesk("/seva/prasadam");
    expect(rail()).toBeNull();
    expect(phoneBar()).toBeNull();
    expect(signOut()).toBeInTheDocument();
    expect(within(header()).queryByRole("link", { name: /Website admin/ })).toBeNull();
    // Their one section is reachable from the header.
    expect(hrefs(header())).toContain("/seva/prasadam");
    expect(document.querySelector("main")!.className).not.toContain("pb-20");
  });

  it("on a phone a temple admin gets Dashboard, Register, Reports and More, and More lists the rest with Website admin last", async () => {
    as("temple_admin", meOf("temple_admin"));
    await renderDesk("/seva/settings/receipt");
    const bar = phoneBar()!;
    expect(bar.className).toContain("md:hidden");
    expect(hrefs(bar)).toEqual(["/seva", "/seva/register", "/seva/reports"]);
    const more = within(bar).getByRole("button", { name: /More/ });
    // The open page (Receipt settings) is inside More.
    expect(more).toHaveAttribute("aria-current", "page");
    expect(bar.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(document.querySelector("main")!.className).toContain("pb-20");

    fireEvent.click(more);
    const dialog = await screen.findByRole("dialog");
    expect(hrefs(dialog)).toEqual([
      "/seva/counter",
      "/seva/prasadam",
      "/seva/day-closes",
      "/seva/seva-settings",
      "/seva/settings",
      "/admin/users",
      "/admin",
    ]);
  });
});

/* ---------- counter frame ---------- */

describe("Seva Entry counter frame", () => {
  it("the counter frame has no rail and no phone bar, and shows Today's receipts, Close day and Sign out", async () => {
    as("receptionist", meOf("receptionist", { counter: "Counter 1" }));
    await renderFocus();
    expect(rail()).toBeNull();
    expect(phoneBar()).toBeNull();
    const top = header();
    expect(top).toHaveTextContent("Seva Counter · Counter 1");
    expect(top).toHaveTextContent("Ramesh · 023");
    expect(within(top).getByRole("link", { name: /Today's receipts/ })).toHaveAttribute("href", "/seva/counter/today");
    expect(within(top).getByRole("link", { name: /Close day/ })).toHaveAttribute("href", "/seva/day-close");
    expect(signOut()).toBeInTheDocument();
    expect(hrefs(top)).not.toContain("/seva");
    expect(hrefs(top)).not.toContain("/admin");
    cleanup();

    as("temple_admin", meOf("temple_admin"));
    await renderFocus();
    expect(within(header()).getByRole("link", { name: /Seva Entry/ })).toHaveAttribute("href", "/seva");
  });

  it("gives every role with other sections a keyboard-reachable Seva Entry menu link to /seva; a receptionist stays counter-only", async () => {
    const cases: [SevaRole, SevaMe][] = [
      ["temple_admin", meOf("temple_admin")],
      ["temple_admin", meOf("temple_admin", { viewOnly: true })],
      ["super_admin", meOf("super_admin")],
    ];
    for (const [role, me] of cases) {
      as(role, me);
      await renderFocus();
      const menu = within(header()).getByRole("link", { name: /Seva Entry menu/ });
      expect(menu).toHaveAttribute("href", "/seva");
      // A plain link in the tab order: Tab reaches it, Enter follows it.
      expect(menu.tagName).toBe("A");
      expect(menu).not.toHaveAttribute("tabindex", "-1");
      menu.focus();
      expect(menu).toHaveFocus();
      cleanup();
    }

    // While the profile loads, a temple admin already has the way back.
    as("temple_admin", null);
    await renderFocus();
    expect(within(header()).getByRole("link", { name: /Seva Entry menu/ })).toHaveAttribute("href", "/seva");
    cleanup();

    as("receptionist", meOf("receptionist", { counter: "Counter 1" }));
    await renderFocus();
    expect(within(header()).queryByRole("link", { name: /Seva Entry menu/ })).toBeNull();
  });
});

/* ---------- sign out ---------- */

describe("Sign out", () => {
  it("Sign out shows Signing out... at once, signs out and goes to /login?redirect=%2Fseva", async () => {
    let finish: () => void = () => undefined;
    const logout = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    as("temple_admin", meOf("temple_admin"));
    mockAuth = { ...mockAuth, logout };
    await renderDesk();
    fireEvent.click(signOut());
    expect(within(header()).getByText("Signing out...")).toBeInTheDocument();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => {
      finish();
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login?redirect=%2Fseva"));
  });

  it("Sign out is there for a person with no seva role, while the profile loads and after it fails", async () => {
    as(null, null);
    await renderDesk();
    expect(signOut()).toBeInTheDocument();
    expect(rail()).toBeNull();
    expect(phoneBar()).toBeNull();
    expect(screen.getByText("page body")).toBeInTheDocument();
    cleanup();

    as(null, null);
    await renderFocus();
    expect(signOut()).toBeInTheDocument();
    cleanup();

    as("receptionist", null, { loading: true });
    await renderFocus();
    expect(signOut()).toBeInTheDocument();
    cleanup();

    as("temple_admin", null, { error: "No connection to the office server." });
    await renderDesk();
    expect(signOut()).toBeInTheDocument();
    expect(screen.getByText("page body")).toBeInTheDocument();
  });
});

/* ---------- layout, print and the guard ---------- */

describe("frames inside the module layout", () => {
  it("every page has exactly one main#main-content, and the header, rail and bar are print:hidden", async () => {
    as("temple_admin", meOf("temple_admin"));
    const SevaLayout = (await import("@/app/seva/layout")).default;
    const DeskLayout = (await import("@/app/seva/(desk)/layout")).default;
    const CounterLayout = (await import("@/app/seva/(counter)/layout")).default;

    mockPath.current = "/seva";
    render(
      <SevaLayout>
        <DeskLayout>
          <p>desk page</p>
        </DeskLayout>
      </SevaLayout>,
    );
    await screen.findByText("desk page");
    expect(document.querySelectorAll("main#main-content")).toHaveLength(1);
    expect(document.querySelectorAll("main")).toHaveLength(1);
    expect(document.querySelector("main#main-content")).toHaveAttribute("tabindex", "-1");
    for (const part of [header(), rail()!, phoneBar()!]) expect(part.className).toContain("print:hidden");
    cleanup();

    mockPath.current = "/seva/counter";
    render(
      <SevaLayout>
        <CounterLayout>
          <p>counter page</p>
        </CounterLayout>
      </SevaLayout>,
    );
    await screen.findByText("counter page");
    expect(document.querySelectorAll("main#main-content")).toHaveLength(1);
    expect(document.querySelectorAll("main")).toHaveLength(1);
    expect(header().className).toContain("print:hidden");
    // Keyboard order follows the screen: the header comes before the page.
    const main = document.querySelector("main#main-content")!;
    expect(header().compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("AdminAuthGuard sends a signed-out visitor back to the page they opened when returnTo is set, and to /admin as before without it", async () => {
    const AdminAuthGuard = (await import("@/components/admin/layout/AdminAuthGuard")).default;
    mockAuth = { user: null, loading: false, canAccessAdmin: false, sevaRole: null };

    const first = render(
      <AdminAuthGuard requiredPermission="billing" returnTo="/seva/counter?x=1">
        <p>inside</p>
      </AdminAuthGuard>,
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith("/login?redirect=%2Fseva%2Fcounter%3Fx%3D1");
    expect(screen.queryByText("inside")).toBeNull();
    first.unmount();

    mockReplace.mockReset();
    render(
      <AdminAuthGuard requiredPermission="billing">
        <p>inside</p>
      </AdminAuthGuard>,
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith("/login?redirect=%2Fadmin");
  });

  it("the module layout passes the opened page and its query to the guard", async () => {
    mockAuth = { user: null, loading: false, canAccessAdmin: false, sevaRole: null };
    mockSevaMe = fakeHook(null);
    mockPath.current = "/seva/register";
    mockPath.search = "status=changed";
    const SevaLayout = (await import("@/app/seva/layout")).default;
    render(
      <SevaLayout>
        <p>inside</p>
      </SevaLayout>,
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith("/login?redirect=%2Fseva%2Fregister%3Fstatus%3Dchanged");
  });

  it("the page transition lives in each group template, so the frame does not remount", async () => {
    expect(fs.existsSync(path.join(ROOT, "app/seva/template.tsx"))).toBe(false);
    for (const group of ["(desk)", "(counter)"]) {
      const file = path.join(ROOT, "app/seva", group, "template.tsx");
      expect(fs.readFileSync(file, "utf8")).toMatch(/export \{ PageTransition as default \} from "@\/components\/seva\/shell\/PageTransition";/);
    }
    const { PageTransition } = await import("@/components/seva/shell/PageTransition");
    expect((await import("@/app/seva/(desk)/template")).default).toBe(PageTransition);
    expect((await import("@/app/seva/(counter)/template")).default).toBe(PageTransition);
  });
});

/* ---------- the site chat bubble ---------- */

describe("site chat bubble", () => {
  it("does not float over any /seva page, and still shows on the rest of the site", async () => {
    const { ChatWidget } = await import("@/components/ai/ChatWidget");
    for (const page of ["/seva", "/seva/counter", "/seva/r1/print"]) {
      mockPath.current = page;
      render(<ChatWidget />);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30));
      });
      expect(screen.queryByRole("button", { name: "Ask Raya" })).toBeNull();
      cleanup();
    }
    mockPath.current = "/sevas";
    render(<ChatWidget />);
    expect(await screen.findByRole("button", { name: "Ask Raya" })).toBeInTheDocument();
  });
});
