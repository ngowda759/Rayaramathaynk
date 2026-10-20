/**
 * Shared set-up for the Firestore rules tests. The emulator address comes from
 * FIRESTORE_EMULATOR_HOST, which `firebase emulators:exec` sets (see the
 * `test:rules` script). The rules under test are the repository's own
 * `firestore.rules`, loaded fresh for every test file.
 */
import { readFileSync } from "fs";
import path from "path";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

export const RULES_PROJECT_ID = "demo-seva";

const RULES_PATH = path.resolve(__dirname, "..", "..", "firestore.rules");

export function createRulesTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: RULES_PROJECT_ID,
    firestore: { rules: readFileSync(RULES_PATH, "utf8") },
  });
}

/** Writes documents with rules switched off, the way the Admin SDK would. */
export async function seedDocs(
  env: RulesTestEnvironment,
  docs: Record<string, Record<string, unknown>>
): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all(
      Object.entries(docs).map(([docPath, data]) => db.doc(docPath).set(data))
    );
  });
}

/** A staff or devotee profile as the server writes it to `users/{uid}`. */
export function userProfile(uid: string, role: string): Record<string, unknown> {
  return {
    uid,
    name: `User ${uid}`,
    email: `${uid}@example.test`,
    phone: "",
    role,
    templeId: "main",
    profileImage: "",
    isApproved: role !== "devotee",
    isActive: true,
    emailVerified: true,
    lastLogin: null,
  };
}
