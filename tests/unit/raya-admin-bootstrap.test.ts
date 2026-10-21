/**
 * Decision-logic tests for the Raya AI administrator bootstrap.
 *
 * These cover the identity-safety contract directly (no database, no
 * credentials): the CLI in scripts/bootstrap-raya-admin.ts only performs I/O
 * around `planBootstrap`, so every refusal and every write is asserted here.
 */

import {
  escapeLikePattern,
  filterLegacyProfilesByEmail,
  normalizeEmail,
  normalizeRole,
  planBootstrap,
  selectAuthUserByEmail,
  type ProfileRow,
} from "@/scripts/lib/raya-admin-bootstrap";

const AUTH_ID = "11111111-1111-1111-1111-111111111111";

function profile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "row-1",
    email: "admin@example.org",
    role: "user",
    active: true,
    auth_user_id: null,
    ...overrides,
  };
}

function baseInput(overrides: Partial<Parameters<typeof planBootstrap>[0]> = {}) {
  return {
    email: "admin@example.org",
    role: "super_admin",
    authUserId: AUTH_ID,
    linkedProfile: null,
    legacyProfiles: [] as ProfileRow[],
    forceRole: false,
    reactivate: false,
    linkLegacy: false,
    ...overrides,
  };
}

describe("normalizeRole / normalizeEmail", () => {
  it("normalizes role casing and whitespace", () => {
    expect(normalizeRole(" Super Admin ")).toBe("super_admin");
    expect(normalizeRole("TEMPLE  ADMIN")).toBe("temple_admin");
    expect(normalizeRole(undefined)).toBe("");
    expect(normalizeRole(42)).toBe("");
  });

  it("lower-cases and trims the email", () => {
    expect(normalizeEmail("  Admin@Example.ORG ")).toBe("admin@example.org");
  });
});

describe("escapeLikePattern", () => {
  it("escapes LIKE metacharacters so an address cannot widen the match", () => {
    expect(escapeLikePattern("a%b@x.org")).toBe("a\\%b@x.org");
    expect(escapeLikePattern("a_b@x.org")).toBe("a\\_b@x.org");
    expect(escapeLikePattern("a\\b@x.org")).toBe("a\\\\b@x.org");
  });

  it("leaves an ordinary address untouched", () => {
    expect(escapeLikePattern("admin@example.org")).toBe("admin@example.org");
  });
});

describe("selectAuthUserByEmail", () => {
  it("selects the single matching Auth user", () => {
    const result = selectAuthUserByEmail(
      [
        { id: "a", email: "other@example.org" },
        { id: "b", email: "Admin@Example.org" },
      ],
      "admin@example.org"
    );
    expect(result).toEqual({ ok: true, user: { id: "b", email: "Admin@Example.org" } });
  });

  it("reports zero matches so the caller can create the user", () => {
    const result = selectAuthUserByEmail([{ id: "a", email: "other@x.org" }], "admin@x.org");
    expect(result).toEqual({ ok: false, count: 0 });
  });

  it("fails closed when two Auth users share the email", () => {
    const result = selectAuthUserByEmail(
      [
        { id: "a", email: "admin@example.org" },
        { id: "b", email: "ADMIN@example.org" },
      ],
      "admin@example.org"
    );
    expect(result).toEqual({ ok: false, count: 2 });
  });

  it("treats a null/absent email as no match", () => {
    expect(selectAuthUserByEmail([{ id: "a", email: null }], "admin@example.org")).toEqual({
      ok: false,
      count: 0,
    });
    expect(selectAuthUserByEmail([{ id: "a" }], "admin@example.org")).toEqual({
      ok: false,
      count: 0,
    });
  });
});

describe("filterLegacyProfilesByEmail", () => {
  it("keeps only unlinked rows whose email matches case-insensitively", () => {
    const rows = [
      profile({ id: "unlinked", auth_user_id: null, email: "Admin@Example.org" }),
      profile({ id: "linked", auth_user_id: AUTH_ID }),
      profile({ id: "other", email: "someone@example.org" }),
    ];
    expect(filterLegacyProfilesByEmail(rows, "admin@example.org").map((r) => r.id)).toEqual([
      "unlinked",
    ]);
  });
});

describe("planBootstrap — fresh bootstrap", () => {
  it("inserts a new authorization row when nothing exists", () => {
    const plan = planBootstrap(baseInput());
    expect(plan).toEqual({ ok: true, kind: "insert", role: "super_admin", warnings: [] });
  });
});

describe("planBootstrap — idempotent re-run", () => {
  it("is a no-op when the row is already linked, active and at the target role", () => {
    const plan = planBootstrap(
      baseInput({ linkedProfile: profile({ auth_user_id: AUTH_ID, role: "super_admin" }) })
    );
    expect(plan).toEqual({ ok: true, kind: "noop", profileId: "row-1", warnings: [] });
  });

  it("warns but does not touch unrelated unlinked rows sharing the email", () => {
    const plan = planBootstrap(
      baseInput({
        linkedProfile: profile({ auth_user_id: AUTH_ID, role: "super_admin" }),
        legacyProfiles: [profile({ id: "legacy-1" })],
      })
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.kind).toBe("noop");
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]).toContain("admin@example.org");
    expect(plan.warnings[0]).toContain("left untouched");
  });
});

describe("planBootstrap — role elevation is opt-in", () => {
  it("refuses to change an existing role without RAYA_ADMIN_FORCE_ROLE", () => {
    const plan = planBootstrap(
      baseInput({ linkedProfile: profile({ auth_user_id: AUTH_ID, role: "user" }) })
    );
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.code).toBe("role_change_requires_opt_in");
    expect(plan.message).toContain('"user"');
    expect(plan.message).toContain("RAYA_ADMIN_FORCE_ROLE=1");
  });

  it("changes the role only when forceRole is set", () => {
    const plan = planBootstrap(
      baseInput({
        linkedProfile: profile({ auth_user_id: AUTH_ID, role: "user" }),
        forceRole: true,
      })
    );
    expect(plan).toEqual({
      ok: true,
      kind: "update",
      profileId: "row-1",
      set: { role: "super_admin" },
      changes: ["role"],
      warnings: [],
    });
  });

  it("treats a role that differs only by casing as no change", () => {
    const plan = planBootstrap(
      baseInput({ linkedProfile: profile({ auth_user_id: AUTH_ID, role: "Super_Admin" }) })
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.kind).toBe("noop");
  });
});

describe("planBootstrap — reactivation is opt-in", () => {
  it("refuses to reactivate an inactive account without RAYA_ADMIN_REACTIVATE", () => {
    const plan = planBootstrap(
      baseInput({
        linkedProfile: profile({ auth_user_id: AUTH_ID, role: "super_admin", active: false }),
      })
    );
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.code).toBe("inactive_profile_requires_opt_in");
    expect(plan.message).toContain("RAYA_ADMIN_REACTIVATE=1");
  });

  it("reactivates only when reactivate is set", () => {
    const plan = planBootstrap(
      baseInput({
        linkedProfile: profile({ auth_user_id: AUTH_ID, role: "super_admin", active: false }),
        reactivate: true,
      })
    );
    expect(plan).toEqual({
      ok: true,
      kind: "update",
      profileId: "row-1",
      set: { active: true },
      changes: ["active"],
      warnings: [],
    });
  });
});

describe("planBootstrap — legacy identity linking is opt-in", () => {
  it("refuses to link an unlinked row that merely shares the email", () => {
    const plan = planBootstrap(baseInput({ legacyProfiles: [profile({ role: "super_admin" })] }));
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.code).toBe("legacy_link_requires_opt_in");
    expect(plan.message).toContain("RAYA_ADMIN_LINK_LEGACY_EMAIL=1");
    expect(plan.message).toContain("row-1");
  });

  it("links the row when linkLegacy is set and the role already matches", () => {
    const plan = planBootstrap(
      baseInput({ legacyProfiles: [profile({ role: "super_admin" })], linkLegacy: true })
    );
    expect(plan).toEqual({
      ok: true,
      kind: "link",
      profileId: "row-1",
      set: { auth_user_id: AUTH_ID },
      changes: ["auth_user_id"],
      warnings: [],
    });
  });

  it("still refuses a role change during a link unless forced", () => {
    const plan = planBootstrap(
      baseInput({ legacyProfiles: [profile({ role: "user" })], linkLegacy: true })
    );
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.code).toBe("role_change_requires_opt_in");
  });

  it("links and elevates only when both flags are given", () => {
    const plan = planBootstrap(
      baseInput({
        legacyProfiles: [profile({ role: "user" })],
        linkLegacy: true,
        forceRole: true,
      })
    );
    expect(plan).toEqual({
      ok: true,
      kind: "link",
      profileId: "row-1",
      set: { auth_user_id: AUTH_ID, role: "super_admin" },
      changes: ["auth_user_id", "role"],
      warnings: [],
    });
  });

  it("refuses to reactivate an inactive legacy row during a link unless allowed", () => {
    const plan = planBootstrap(
      baseInput({
        legacyProfiles: [profile({ role: "super_admin", active: false })],
        linkLegacy: true,
      })
    );
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.code).toBe("inactive_profile_requires_opt_in");
  });
});

describe("planBootstrap — ambiguous identity fails closed", () => {
  it("refuses when two unlinked rows share the email, even with the opt-in flag", () => {
    const plan = planBootstrap(
      baseInput({
        legacyProfiles: [profile({ id: "row-1" }), profile({ id: "row-2" })],
        linkLegacy: true,
        forceRole: true,
        reactivate: true,
      })
    );
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.code).toBe("ambiguous_legacy_email");
    expect(plan.message).toContain("2 unlinked public.users rows");
  });

  it("does not leak the row contents in the refusal message", () => {
    const plan = planBootstrap(
      baseInput({ legacyProfiles: [profile({ id: "secret-id-1" }), profile({ id: "secret-id-2" })] })
    );
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.message).not.toContain("secret-id-1");
    expect(plan.message).not.toContain("secret-id-2");
  });
});

describe("planBootstrap — a linked row always wins over legacy candidates", () => {
  it("never inserts a duplicate when a linked row already exists", () => {
    const plan = planBootstrap(
      baseInput({
        linkedProfile: profile({ id: "linked", auth_user_id: AUTH_ID, role: "super_admin" }),
        legacyProfiles: [profile({ id: "legacy" })],
      })
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.kind).not.toBe("insert");
  });
});
