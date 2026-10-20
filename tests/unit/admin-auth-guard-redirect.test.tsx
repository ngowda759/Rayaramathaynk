/**
 * AdminAuthGuard, the branch without `returnTo` (every /admin page): a signed-out visitor is sent to sign in with the
 * page's own `?redirect=` only when it is a path on this site; anything else becomes /admin (A4S security gate, H-1).
 */
import { render, waitFor } from "@testing-library/react";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";

const mockSearch = { current: "" };
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(mockSearch.current),
}));

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false, canAccessAdmin: false, sevaRole: null }),
}));

jest.mock("@/lib/firebase", () => ({
  getFirebaseConfigStatus: () => ({ isValid: true, missingFields: [] }),
}));

async function signInAddressFor(search: string): Promise<string> {
  mockSearch.current = search;
  mockReplace.mockReset();
  const view = render(
    <AdminAuthGuard requiredPermission="admin">
      <p>inside</p>
    </AdminAuthGuard>,
  );
  await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  view.unmount();
  return mockReplace.mock.calls[0][0] as string;
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
