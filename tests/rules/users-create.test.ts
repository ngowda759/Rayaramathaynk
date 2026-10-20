/**
 * firestore.rules - creating `users/{userId}` (DB section 17.4, M04-F47; security gate S-1 and S-8).
 * A signed-in person may create only their own profile, and only as a devotee:
 * no admin or seva role, no self-approval, no self-deactivated profile.
 */
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { createRulesTestEnv } from "./rules-test-env";

const ALICE = "alice-uid";
const BOB = "bob-uid";

/** Exactly what sign-up writes (lib/auth.ts registerUser, services/auth.service.ts register). */
function signUpPayload(uid: string): Record<string, unknown> {
  return {
    uid,
    name: "Alice",
    email: "alice@example.test",
    phone: "",
    role: "devotee",
    templeId: "main",
    profileImage: "",
    isApproved: false,
    isActive: true,
    emailVerified: false,
    lastLogin: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
}

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
});

describe("firestore.rules - users create", () => {
  it("denies creating own user doc with role super_admin", async () => {
    await assertFails(
      userDocAs(ALICE, ALICE).set({
        ...signUpPayload(ALICE),
        role: "super_admin",
        isApproved: true,
        isActive: true,
      })
    );
  });

  it.each(["temple_admin", "receptionist", "billing", "Billing", "admin", "prasadam_counter", "Super Admin"])(
    "denies role %s on create",
    async (role) => {
      await assertFails(userDocAs(ALICE, ALICE).set({ ...signUpPayload(ALICE), role }));
    }
  );

  it("denies isApproved true on create", async () => {
    await assertFails(userDocAs(ALICE, ALICE).set({ ...signUpPayload(ALICE), isApproved: true }));
  });

  it("allows create with role devotee and the fields sign-up writes", async () => {
    await assertSucceeds(userDocAs(ALICE, ALICE).set(signUpPayload(ALICE)));
  });

  it("allows create with no role, isApproved or isActive field", async () => {
    const payload = signUpPayload(ALICE);
    delete payload.role;
    delete payload.isApproved;
    delete payload.isActive;
    await assertSucceeds(userDocAs(ALICE, ALICE).set(payload));
  });

  it("allows the sign-in path that creates a missing profile with a merge write", async () => {
    await assertSucceeds(
      userDocAs(ALICE, ALICE).set(
        {
          uid: ALICE,
          name: "alice",
          email: "alice@example.test",
          phone: "",
          role: "devotee",
          templeId: "main",
          profileImage: "",
          isApproved: false,
          isActive: true,
          emailVerified: false,
          lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    );
  });

  it("denies creating a doc for another uid (path holds the other uid, data.uid holds the caller's)", async () => {
    await assertFails(userDocAs(ALICE, BOB).set(signUpPayload(ALICE)));
  });

  it("denies creating own doc with data.uid set to another uid", async () => {
    await assertFails(userDocAs(ALICE, ALICE).set(signUpPayload(BOB)));
  });

  it("denies an unauthenticated create", async () => {
    await assertFails(
      env.unauthenticatedContext().firestore().collection("users").doc(ALICE).set(signUpPayload(ALICE))
    );
  });
});
