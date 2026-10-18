/**
 * firestore.rules - the `settings` collection (security gate S-6).
 * `settings/financeSettings` holds the UPI id the counter shows to devotees, so
 * only admins may write any settings doc. Reads stay public because the public
 * pages (About, Facilities, Future plans, Trust, footer, donations) read these
 * docs without signing in.
 */
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
  type RulesTestContext,
} from "@firebase/rules-unit-testing";
import { createRulesTestEnv, seedDocs, userProfile } from "./rules-test-env";

const TEMPLE_ADMIN = "ta-uid";
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
    [`users/${TEMPLE_ADMIN}`]: userProfile(TEMPLE_ADMIN, "temple_admin"),
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

describe("firestore.rules - settings writes are admin-only", () => {
  it.each(nonAdminCallers)("%s cannot rewrite the UPI id in settings/financeSettings", async (_label, caller) => {
    const ref = caller().firestore().doc("settings/financeSettings");
    await assertFails(ref.update({ "upi.id": "outsider@examplebank" }));
    await assertFails(
      ref.set({ upi: { enabled: true, id: "outsider@examplebank", displayName: "Outsider" } })
    );
  });

  it.each(nonAdminCallers)("%s cannot create, change or delete other settings docs", async (_label, caller) => {
    const db = caller().firestore();
    await assertFails(db.doc("settings/newDoc").set({ any: "value" }));
    await assertFails(db.doc("settings/aboutUs").update({ title: "Changed" }));
    await assertFails(db.doc("settings/aboutUs").delete());
  });

  it("a temple admin can write settings", async () => {
    const db = env.authenticatedContext(TEMPLE_ADMIN).firestore();
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
