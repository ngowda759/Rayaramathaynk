/**
 * firestore.rules - the `sevas` collection (A3 security gate L-6, plan C-39).
 * Firestore `sevas` is the mirror the seva settings write through the Admin SDK (which these rules do not affect);
 * the public site still reads it. From a browser only a super admin may write it, so a view-only or legacy admin
 * cannot change the seva amounts the public site shows without an audit row. Reads stay public.
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

const SEVA = { name: "Paaduka Pooja", amount: 505, active: true, displayOrder: 1, category: "Pooja" };

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
    "sevas/paaduka": SEVA,
  });
});

const notSuperAdmin: Array<[string, () => RulesTestContext]> = [
  ["unauthenticated", () => env.unauthenticatedContext()],
  ["devotee", () => env.authenticatedContext(DEVOTEE)],
  ["receptionist", () => env.authenticatedContext(RECEPTIONIST)],
  ["temple_admin", () => env.authenticatedContext(TEMPLE_ADMIN)],
  ["legacy admin", () => env.authenticatedContext(LEGACY_ADMIN)],
  ["Billing", () => env.authenticatedContext(BILLING)],
];

describe("firestore.rules - sevas writes are super-admin-only", () => {
  it.each(notSuperAdmin)("%s cannot create, change or delete a seva", async (_label, caller) => {
    const db = caller().firestore();
    await assertFails(db.doc("sevas/paaduka").update({ amount: 1 }));
    await assertFails(db.doc("sevas/new-seva").set({ ...SEVA, name: "New" }));
    await assertFails(db.doc("sevas/paaduka").delete());
  });

  it("a super admin can write sevas", async () => {
    const db = env.authenticatedContext(SUPER_ADMIN).firestore();
    await assertSucceeds(db.doc("sevas/paaduka").update({ amount: 510 }));
    await assertSucceeds(db.doc("sevas/new-seva").set({ ...SEVA, name: "New" }));
  });

  it("anyone can read sevas", async () => {
    await assertSucceeds(env.unauthenticatedContext().firestore().doc("sevas/paaduka").get());
  });
});
