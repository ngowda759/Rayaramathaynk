import {
  normalizeUsersEmail,
  planUsersIdentityLink,
  type UsersIdentityLinkInput,
  type UsersIdentityRow,
} from "@/lib/seva/server/users-identity-link";

const EMAIL = "lakshmi.n@example.com";

function row(over: Partial<UsersIdentityRow> = {}): UsersIdentityRow {
  return {
    id: "row-1",
    email: EMAIL,
    auth_user_id: null,
    role: "devotee",
    active: true,
    display_name: "Lakshmi N",
    ...over,
  };
}

function plan(over: Partial<UsersIdentityLinkInput> = {}) {
  return planUsersIdentityLink({ authUserId: null, email: EMAIL, linkExisting: false, rows: [], ...over });
}

describe("planUsersIdentityLink", () => {
  it("does nothing when no row carries the email", () => {
    expect(plan()).toEqual({ kind: "none" });
    expect(plan({ linkExisting: true })).toEqual({ kind: "none" });
  });

  it("treats a row already owned by the resolved identity as authoritative", () => {
    expect(
      plan({ authUserId: "uid-1", rows: [row({ auth_user_id: "uid-1", email: "other@example.com" })] }),
    ).toMatchObject({ kind: "already-linked", row: { id: "row-1" } });
  });

  it("links exactly one unlinked row with the same email only when the office confirmed it", () => {
    expect(plan({ linkExisting: true, rows: [row()] })).toMatchObject({ kind: "link", row: { id: "row-1" } });
    expect(plan({ linkExisting: false, rows: [row()] })).toMatchObject({
      kind: "needs-confirmation",
      row: { id: "row-1" },
    });
  });

  it("never overwrites a row linked to a different identity", () => {
    for (const linkExisting of [false, true]) {
      expect(plan({ linkExisting, rows: [row({ auth_user_id: "uid-other" })] })).toEqual({
        kind: "refuse",
        reason: "foreign",
      });
    }
  });

  it("fails closed on more than one unlinked row for the email", () => {
    expect(plan({ linkExisting: true, rows: [row({ id: "a" }), row({ id: "b" })] })).toEqual({
      kind: "refuse",
      reason: "ambiguous",
    });
  });

  it("does not treat a case or space variant as the same account", () => {
    for (const email of ["Lakshmi.N@Example.com", " lakshmi.n@example.com "]) {
      expect(plan({ linkExisting: true, rows: [row({ email })] })).toEqual({
        kind: "refuse",
        reason: "non-normalized",
      });
    }
  });

  it("does not link a second row to an identity that already owns one", () => {
    expect(
      plan({
        authUserId: "uid-1",
        linkExisting: true,
        rows: [
          row({ id: "owned", auth_user_id: "uid-1", email: "other@example.com" }),
          row({ id: "legacy" }),
        ],
      }),
    ).toMatchObject({ kind: "already-linked", row: { id: "owned" } });
  });

  it("normalizes only for comparison, never for selection", () => {
    expect(normalizeUsersEmail("  A@B.Com ")).toBe("a@b.com");
    expect(plan({ linkExisting: true, rows: [row({ email: "Lakshmi.N@Example.COM" })] })).toEqual({
      kind: "refuse",
      reason: "non-normalized",
    });
  });
});
