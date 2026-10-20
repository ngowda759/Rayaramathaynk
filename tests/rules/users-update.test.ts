/**
 * firestore.rules - updating `users/{userId}` (DB section 3.3 rows 19-20; security gate S-7).
 * `role`, `isActive` and `isApproved` are written only by the server staff API
 * through the Admin SDK, so no client - not even a super admin - may change
 * them. Every other profile field stays editable by its owner and by admins.
 */
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { createRulesTestEnv, seedDocs, userProfile } from "./rules-test-env";

const TEMPLE_ADMIN = "ta-uid";
const SUPER_ADMIN = "sa-uid";
const DEVOTEE = "devotee-uid";

let env: RulesTestEnvironment;

function userDocAs(callerUid: string, docId: string) {
  return env.authenticatedContext(callerUid).firestore().collection("users").doc(docId);
}

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
    [`users/${SUPER_ADMIN}`]: userProfile(SUPER_ADMIN, "super_admin"),
    [`users/${DEVOTEE}`]: userProfile(DEVOTEE, "devotee"),
  });
});

describe("firestore.rules - users update: access fields are server-only", () => {
  it("temple_admin cannot set own role to super_admin", async () => {
    await assertFails(userDocAs(TEMPLE_ADMIN, TEMPLE_ADMIN).update({ role: "super_admin" }));
  });

  it("temple_admin cannot set another user's role", async () => {
    await assertFails(userDocAs(TEMPLE_ADMIN, DEVOTEE).update({ role: "temple_admin" }));
    await assertFails(userDocAs(TEMPLE_ADMIN, SUPER_ADMIN).update({ role: "devotee" }));
  });

  it("temple_admin cannot change another user's isActive or isApproved", async () => {
    await assertFails(userDocAs(TEMPLE_ADMIN, SUPER_ADMIN).update({ isActive: false }));
    await assertFails(userDocAs(TEMPLE_ADMIN, DEVOTEE).update({ isApproved: true }));
  });

  it("super_admin cannot change a role from the client either", async () => {
    await assertFails(userDocAs(SUPER_ADMIN, DEVOTEE).update({ role: "receptionist" }));
    await assertFails(userDocAs(SUPER_ADMIN, SUPER_ADMIN).update({ isApproved: false }));
  });

  it("a role cannot be removed from the client", async () => {
    await assertFails(
      userDocAs(TEMPLE_ADMIN, DEVOTEE).update({ role: firebase.firestore.FieldValue.delete() })
    );
  });

  it("devotee cannot set own role, isApproved or isActive", async () => {
    await assertFails(userDocAs(DEVOTEE, DEVOTEE).update({ role: "super_admin" }));
    await assertFails(userDocAs(DEVOTEE, DEVOTEE).update({ isApproved: true }));
    await assertFails(userDocAs(DEVOTEE, DEVOTEE).update({ isActive: false }));
  });

  it("devotee cannot edit another user's profile", async () => {
    await assertFails(userDocAs(DEVOTEE, TEMPLE_ADMIN).update({ name: "Changed" }));
  });

  it("an unauthenticated caller cannot update a profile", async () => {
    await assertFails(
      env.unauthenticatedContext().firestore().collection("users").doc(DEVOTEE).update({ name: "Changed" })
    );
  });
});

describe("firestore.rules - users update: ordinary edits keep working", () => {
  it("owner can update own profile fields", async () => {
    await assertSucceeds(
      userDocAs(DEVOTEE, DEVOTEE).update({
        name: "New Name",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
  });

  it("the sign-in merge write that repeats unchanged role, isApproved and isActive succeeds", async () => {
    await assertSucceeds(
      userDocAs(TEMPLE_ADMIN, TEMPLE_ADMIN).set(
        {
          uid: TEMPLE_ADMIN,
          role: "temple_admin",
          isApproved: true,
          isActive: true,
          emailVerified: true,
          lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    );
  });

  it("temple_admin can edit another user's non-access fields", async () => {
    await assertSucceeds(userDocAs(TEMPLE_ADMIN, DEVOTEE).update({ name: "Corrected Name" }));
  });
});
