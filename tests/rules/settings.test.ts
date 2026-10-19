/**
 * firestore.rules - the `settings` collection (security gate S-6, A3 security gate H-1).
 * `settings/financeSettings` holds the UPI id the counter shows to devotees, so only a super admin may write it;
 * temple admins (view-only ones and legacy `admin` included - the rules cannot see view-only) may still write the
 * other settings docs. Reads stay public because the public pages (About, Facilities, Future plans, Trust, footer,
 * donations) read these docs without signing in.
 */
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
  type RulesTestContext,
} from "@firebase/rules-unit-testing";
import { createRulesTestEnv, seedDocs, userProfile } from "./rules-test-env";

const SUPER_ADMIN = "sa-uid";
const TEMPLE_ADMIN = "ta-uid";
const LEGACY_ADMIN = "legacy-admin-uid";
const BILLING = "billing-uid";
const DEVOTEE = "devotee-uid";
const RECEPTIONIST = "receptionist-uid";
const PRASADAM = "prasadam-uid";

const FINANCE_SETTINGS = {
  upi: { enabled: true, id: "temple@examplebank", displayName: "Sample Temple" },
};

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createRulesTestEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedDocs(env, {
    [`users/${SUPER_ADMIN}`]: userProfile(SUPER_ADMIN, "super_admin"),
    [`users/${TEMPLE_ADMIN}`]: userProfile(TEMPLE_ADMIN, "temple_admin"),
    [`users/${LEGACY_ADMIN}`]: userProfile(LEGACY_ADMIN, "admin"),
    [`users/${BILLING}`]: userProfile(BILLING, "Billing"),
    [`users/${DEVOTEE}`]: userProfile(DEVOTEE, "devotee"),
    [`users/${RECEPTIONIST}`]: userProfile(RECEPTIONIST, "receptionist"),
    [`users/${PRASADAM}`]: userProfile(PRASADAM, "prasadam_counter"),
    "settings/financeSettings": FINANCE_SETTINGS,
    "settings/aboutUs": { title: "About" },
  });
});

const nonAdminCallers: Array<[string, () => RulesTestContext]> = [
  ["unauthenticated", () => env.unauthenticatedContext()],
  ["devotee", () => env.authenticatedContext(DEVOTEE)],
  ["receptionist", () => env.authenticatedContext(RECEPTIONIST)],
  ["prasadam_counter", () => env.authenticatedContext(PRASADAM)],
];

/** Admins the old rule let write every settings doc; below super admin, so not the counter's UPI payee. */
const belowSuperAdmin: Array<[string, () => RulesTestContext]> = [
  ["temple_admin", () => env.authenticatedContext(TEMPLE_ADMIN)],
  ["legacy admin", () => env.authenticatedContext(LEGACY_ADMIN)],
  ["Billing", () => env.authenticatedContext(BILLING)],
];

describe("firestore.rules - settings writes are admin-only", () => {
  it.each([...nonAdminCallers, ...belowSuperAdmin])(
    "%s cannot rewrite the UPI id in settings/financeSettings",
    async (_label, caller) => {
      const ref = caller().firestore().doc("settings/financeSettings");
      await assertFails(ref.update({ "upi.id": "outsider@examplebank" }));
      await assertFails(
        ref.set({ upi: { enabled: true, id: "outsider@examplebank", displayName: "Outsider" } })
      );
      await assertFails(ref.delete());
    }
  );

  it.each(nonAdminCallers)("%s cannot create, change or delete other settings docs", async (_label, caller) => {
    const db = caller().firestore();
    await assertFails(db.doc("settings/newDoc").set({ any: "value" }));
    await assertFails(db.doc("settings/aboutUs").update({ title: "Changed" }));
    await assertFails(db.doc("settings/aboutUs").delete());
  });

  it("a temple admin can still write the other settings docs", async () => {
    const db = env.authenticatedContext(TEMPLE_ADMIN).firestore();
    await assertSucceeds(db.doc("settings/footer").set({ text: "Footer" }));
    await assertSucceeds(db.doc("settings/aboutUs").update({ title: "About the Matha" }));
  });

  it("only a super admin can write settings/financeSettings (A3 security gate H-1)", async () => {
    const db = env.authenticatedContext(SUPER_ADMIN).firestore();
    await assertSucceeds(db.doc("settings/financeSettings").update({ "upi.displayName": "Temple" }));
    await assertSucceeds(db.doc("settings/footer").set({ text: "Footer" }));
  });
});

describe("firestore.rules - settings reads stay public", () => {
  it("an unauthenticated visitor can read public settings docs", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(db.doc("settings/aboutUs").get());
    await assertSucceeds(db.doc("settings/financeSettings").get());
  });
});
