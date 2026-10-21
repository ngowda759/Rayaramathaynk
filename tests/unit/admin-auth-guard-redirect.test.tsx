/**
 * AdminAuthGuard, the branch without `returnTo` (every /admin page): a signed-out visitor is sent to sign in with the
 * page's own `?redirect=` only when it is a path on this site; anything else becomes /admin (A4S security gate, H-1).
 *
 * Also asserts the Raya AI authentication isolation (PR #349 review): the Supabase session may only satisfy the
 * `/admin/ai/*` subtree, the Raya AI sign-in page is not gated, and every other /admin path keeps the Firebase gate.
 */
import { render, waitFor } from "@testing-library/react";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";

const mockSearch = { current: "" };
const mockPathname = { current: "/admin/events" };
const mockReplace = jest.fn();

// Mutable auth state so each test can choose the provider situation.
const authState = {
  firebaseUser: null as null | { uid: string },
  canAccessAdmin: false,
  supabaseSession: null as null | { access_token: string },
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(mockSearch.current),
  usePathname: () => mockPathname.current,
}));

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: authState.firebaseUser,
    loading: false,
    canAccessAdmin: authState.canAccessAdmin,
    sevaRole: null,
  }),
}));

jest.mock("@/hooks/useSupabaseSession", () => ({
  useSupabaseSession: () => ({ session: authState.supabaseSession, loading: false }),
}));

jest.mock("@/lib/firebase", () => ({
  getFirebaseConfigStatus: () => ({ isValid: true, missingFields: [] }),
}));

function reset() {
  mockSearch.current = "";
  mockPathname.current = "/admin/events";
  mockReplace.mockReset();
  authState.firebaseUser = null;
  authState.canAccessAdmin = false;
  authState.supabaseSession = null;
}

beforeEach(reset);

async function signInAddressFor(search: string): Promise<string> {
  mockSearch.current = search;
  const view = render(
    <AdminAuthGuard requiredPermission="admin">
      <p>inside</p>
    </AdminAuthGuard>,
  );
  await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  const address = mockReplace.mock.calls[0][0] as string;
  view.unmount();
  return address;
}

describe("AdminAuthGuard relays only a same-origin ?redirect=", () => {
  it.each([
    ["javascript:alert(1)", "redirect=javascript:alert(1)"],
    ["//evil.example", "redirect=//evil.example"],
    ["encoded //evil.example", "redirect=%2F%2Fevil.example"],
    ["/\\evil.example", "redirect=/%5Cevil.example"],
    ["https://evil.example", "redirect=https://evil.example"],
    // FINAL-FIX N-8 (H-1): a dot segment that a URL parser folds into //host, raw and percent-encoded.
    ["dot segment /.//evil.example", "redirect=/.//evil.example"],
    ["encoded dot segment /.//evil.example", "redirect=%2F.%2F%2Fevil.example"],
    ["dot-dot segment /..//evil.example", "redirect=/..//evil.example"],
    ["no redirect", ""],
  ])("%s becomes /admin", async (_label, search) => {
    expect(await signInAddressFor(search)).toBe("/login?redirect=%2Fadmin");
  });

  it("keeps a same-origin admin path with its query", async () => {
    expect(await signInAddressFor("redirect=%2Fadmin%2Fevents%3Fpage%3D2")).toBe(
      "/login?redirect=%2Fadmin%2Fevents%3Fpage%3D2",
    );
  });
});

describe("AdminAuthGuard — Raya AI authentication isolation", () => {
  it("sends a signed-out non-AI admin page to the Firebase login, never the Raya AI login", async () => {
    const address = await signInAddressFor("");
    expect(address.startsWith("/login")).toBe(true);
    expect(address).not.toContain("/admin/ai/login");
  });

  it("does not let a Supabase session satisfy a non-AI admin page", async () => {
    authState.supabaseSession = { access_token: "sb-token" };
    // No Firebase user: the non-AI gate must still redirect to the Firebase login.
    const address = await signInAddressFor("");
    expect(address.startsWith("/login")).toBe(true);
    expect(address).not.toContain("/admin/ai/login");
  });

  it("sends a signed-out AI page to the Raya AI login with a validated redirect", async () => {
    mockPathname.current = "/admin/ai/settings";
    render(
      <AdminAuthGuard requiredPermission="admin">
        <p>inside</p>
      </AdminAuthGuard>,
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    const address = mockReplace.mock.calls[0][0] as string;
    expect(address).toBe(
      `/admin/ai/login?redirect=${encodeURIComponent("/admin/ai/settings")}`,
    );
  });

  it("never relays an off-site redirect to the Raya AI login route", async () => {
    mockPathname.current = "/admin/ai/settings";
    mockSearch.current = "redirect=//evil.example";
    render(
      <AdminAuthGuard requiredPermission="admin">
        <p>inside</p>
      </AdminAuthGuard>,
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    const address = mockReplace.mock.calls[0][0] as string;
    expect(address).toBe(
      `/admin/ai/login?redirect=${encodeURIComponent("/admin/ai/settings")}`,
    );
    expect(address).not.toContain("evil.example");
  });

  it("admits an AI page on a Supabase session without a Firebase user", async () => {
    mockPathname.current = "/admin/ai/settings";
    authState.supabaseSession = { access_token: "sb-token" };
    const view = render(
      <AdminAuthGuard requiredPermission="admin">
        <p>inside</p>
      </AdminAuthGuard>,
    );
    await waitFor(() => expect(view.getByText("inside")).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
    view.unmount();
  });

  it("renders the Raya AI login page without gating, so there is no redirect loop", async () => {
    mockPathname.current = "/admin/ai/login";
    const view = render(
      <AdminAuthGuard requiredPermission="admin">
        <p>sign-in form</p>
      </AdminAuthGuard>,
    );
    await waitFor(() => expect(view.getByText("sign-in form")).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
    view.unmount();
  });

  // A password-reset link arrives with `?code=`/`?token_hash=`/`#access_token=`.
  // Gating the reset page would bounce the visitor (and drop the credential)
  // before it could be exchanged, so both recovery pages must render ungated.
  it.each(["/admin/ai/forgot-password", "/admin/ai/reset-password"])(
    "renders %s without gating, so a reset link is never bounced",
    async (pathname) => {
      mockPathname.current = pathname;
      const view = render(
        <AdminAuthGuard requiredPermission="admin">
          <p>recovery form</p>
        </AdminAuthGuard>,
      );
      await waitFor(() => expect(view.getByText("recovery form")).toBeTruthy());
      expect(mockReplace).not.toHaveBeenCalled();
      view.unmount();
    },
  );

  it("keeps a Supabase-session-free AI page gated even with the recovery pages exempt", async () => {
    mockPathname.current = "/admin/ai/reset-password/extra";
    render(
      <AdminAuthGuard requiredPermission="admin">
        <p>inside</p>
      </AdminAuthGuard>,
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockReplace.mock.calls[0][0]).toBe(
      `/admin/ai/login?redirect=${encodeURIComponent("/admin/ai/reset-password/extra")}`,
    );
  });
});
