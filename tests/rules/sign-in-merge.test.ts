/**
 * firestore.rules - the site's sign-in merge write (security gate S-7 follow-up).
 * The payload under test is the real one, from lib/auth/sign-in-profile.ts,
 * which services/auth.service.ts `login` and lib/auth.ts `loginUser` both send.
 * The staff API's setAccessProfile writes `{ role, isActive, email, displayName }`
 * with no `isApproved`; that staff member's first sign-in must still pass the
 * rules, and the rules must stay strict (no client write adds an access field).
 */
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { buildSignInProfileWrite } from "@/lib/auth/sign-in-profile";
import { createRulesTestEnv, seedDocs, userProfile } from "./rules-test-env";

let env: RulesTestEnvironment;

function ownUserDoc(uid: string) {
  return env.authenticatedContext(uid).firestore().collection("users").doc(uid);
}

/** A users doc as the staff API's setAccessProfile writes it. */
function staffApiProfile(uid: string, role: string): Record<string, unknown> {
  return { role, isActive: true, email: `${uid}@example.test`, displayName: `Staff ${uid}` };
}

/** Reads the doc the way sign-in does, then sends the sign-in merge write. */
async function signInMerge(uid: string) {
  const ref = ownUserDoc(uid);
  const snapshot = await ref.get();
  const write = buildSignInProfileWrite({
    account: { uid, displayName: `Staff ${uid}`, email: `${uid}@example.test`, emailVerified: true },
    typedEmail: `${uid}@example.test`,
    existingProfile: snapshot.exists ? snapshot.data() : undefined,
    now: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref.set(write, { merge: true });
}

async function storedProfile(uid: string): Promise<Record<string, unknown> | undefined> {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (context) => {
    data = (await context.firestore().collection("users").doc(uid).get()).data();
  });
  return data;
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

describe("firestore.rules - sign-in merge on a staff doc written by the staff API", () => {
  it.each(["receptionist", "temple_admin", "super_admin", "prasadam_counter"])(
    "first sign-in of a %s whose doc has no isApproved succeeds",
    async (role) => {
      const uid = `${role}-uid`;
      await seedDocs(env, { [`users/${uid}`]: staffApiProfile(uid, role) });

      await assertSucceeds(signInMerge(uid));

      const stored = await storedProfile(uid);
      expect(stored?.role).toBe(role);
      expect(stored?.isActive).toBe(true);
      expect(stored).not.toHaveProperty("isApproved");
      expect(stored?.uid).toBe(uid);
    }
  );

  it("sign-in on a full profile (all three access fields) succeeds and changes none of them", async () => {
    await seedDocs(env, { "users/ta-uid": userProfile("ta-uid", "temple_admin") });

    await assertSucceeds(signInMerge("ta-uid"));

    const stored = await storedProfile("ta-uid");
    expect(stored).toMatchObject({ role: "temple_admin", isApproved: true, isActive: true });
  });

  it("first sign-in with no profile yet creates a devotee profile", async () => {
    await assertSucceeds(signInMerge("new-uid"));

    const stored = await storedProfile("new-uid");
    expect(stored).toMatchObject({ uid: "new-uid", role: "devotee", isApproved: false, isActive: true });
  });

  it("the rule stays strict: a client write that adds a missing isApproved is still refused", async () => {
    await seedDocs(env, { "users/rec-uid": staffApiProfile("rec-uid", "receptionist") });

    await assertFails(ownUserDoc("rec-uid").set({ isApproved: false }, { merge: true }));
  });
});
