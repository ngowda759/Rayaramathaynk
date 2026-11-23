/**
 * @jest-environment node
 *
 * F-04.6: the settings server actions now require `settings.general.write`
 * (super_admin/temple_admin), not just any console role.
 */

jest.mock("server-only", () => ({}), { virtual: true });

const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));
const mockUpdate = jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) }));
const mockFrom = jest.fn(() => ({ insert: mockInsert, update: mockUpdate, select: mockSelect }));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

const mockVerifyAdminUserResult = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => ({
  verifyAdminUserResult: (...args: unknown[]) => mockVerifyAdminUserResult(...args),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue(new Headers()),
}));

jest.mock("next/server", () => ({
  NextRequest: class {
    constructor(_url: string, init?: { headers?: Headers }) {
      return { headers: init?.headers ?? new Headers() };
    }
  },
}));

import { createSettingsAction } from "../../app/actions/settings";

const payload = {
  templeName: "Sri Raghavendra Swamy Matha",
  contactEmail: "",
  contactPhone: "",
  address: "",
  footerText: "",
  welcomeMessage: "",
};

function verified(role: string) {
  mockVerifyAdminUserResult.mockResolvedValue({
    ok: true,
    provider: "supabase",
    user: { uid: "uid-1", email: "admin@example.com", role, provider: "supabase" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSingle.mockResolvedValue({ data: { id: "settings-1" }, error: null });
});

describe("settings server action capabilities", () => {
  test.each(["staff", "office_staff", "priest", "billing"])(
    "%s cannot create site settings",
    async (role) => {
      verified(role);
      await expect(createSettingsAction(payload)).rejects.toThrow("Unauthorized");
      expect(mockInsert).not.toHaveBeenCalled();
    },
  );

  test.each(["super_admin", "temple_admin", "admin"])(
    "%s can create site settings",
    async (role) => {
      verified(role);
      await expect(createSettingsAction(payload)).resolves.toBe("settings-1");
      expect(mockInsert).toHaveBeenCalled();
    },
  );

  test("an unauthenticated caller cannot create site settings", async () => {
    mockVerifyAdminUserResult.mockResolvedValue({
      ok: false,
      reason: "missing_token",
      status: 401,
      message: "Missing token",
    });
    await expect(createSettingsAction(payload)).rejects.toThrow("Unauthorized");
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
