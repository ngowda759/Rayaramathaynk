import { normalizeRole, type UserRole } from "@/types/user";

describe("normalizeRole - the two seva roles (DB §3.2)", () => {
  it("keeps receptionist as its own role", () => {
    expect(normalizeRole("receptionist")).toBe("receptionist");
  });

  it("keeps prasadam_counter as its own role", () => {
    expect(normalizeRole("prasadam_counter")).toBe("prasadam_counter");
  });

  it("maps the display spelling 'Prasadam Counter' to prasadam_counter", () => {
    expect(normalizeRole("Prasadam Counter" as UserRole)).toBe("prasadam_counter");
  });

  it("maps the display spelling 'Receptionist' to receptionist", () => {
    expect(normalizeRole("Receptionist" as UserRole)).toBe("receptionist");
  });
});

describe("normalizeRole - existing roles are unchanged", () => {
  it.each<[UserRole, string]>([
    ["super_admin", "super_admin"],
    ["Super Admin", "super_admin"],
    ["temple_admin", "admin"],
    ["Temple Admin", "admin"],
    ["priest", "admin"],
    ["staff", "admin"],
    ["Office Staff", "admin"],
    ["billing", "billing"],
    ["Billing", "billing"],
    ["volunteer", "volunteer"],
    ["devotee", "devotee"],
  ])("%j -> %j", (role, expected) => {
    expect(normalizeRole(role)).toBe(expected);
  });

  it("treats an unknown role as devotee", () => {
    expect(normalizeRole("superadmin" as UserRole)).toBe("devotee");
  });
});
