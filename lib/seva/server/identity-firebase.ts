/**
 * Firebase implementation of the seva identity adapter: Firebase Auth for logins, Firestore `users/{uid}` for the
 * role and the active flag (DB §3.2). Firebase Admin modules load on first use, as in lib/auth/verify-id-token.ts.
 */

import "server-only";
import { checkBearerIdToken } from "@/lib/auth/verify-id-token";
import { SevaError } from "@/lib/seva/errors";
import type { IdentityAdapter } from "./identity";

async function adminAuth() {
  const { getAdminApp } = await import("@/lib/admin-firebase");
  const app = await getAdminApp();
  const { getAuth } = await import("firebase-admin/auth");
  return getAuth(app);
}

async function userDoc(externalUid: string) {
  const { getAdminFirestore } = await import("@/lib/admin-firebase");
  const db = await getAdminFirestore();
  return db.collection("users").doc(externalUid);
}

function errorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

export const firebaseIdentityAdapter: IdentityAdapter = {
  async verifyRequest(req) {
    // checkRevoked: a disabled login or revoked sessions (offboarding) stop working at once, not when the hour-long
    // ID token runs out. That check is a live call to Firebase Auth, so an outage or a network blip must not read as
    // "signed out": it throws, the guard answers 500, and the counter retries or offers offline (DB §16.2).
    const result = await checkBearerIdToken(req, { checkRevoked: true });
    if (result.status === "unavailable") throw new SevaError("internal");
    if (result.status !== "ok") return null;
    return { externalUid: result.caller.uid, email: result.caller.email };
  },

  async getAccessProfile(externalUid) {
    const snapshot = await (await userDoc(externalUid)).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data() ?? {};
    // Only these two fields; never `email` (editable by the person). A missing or non-boolean isActive is inactive.
    return { role: data.role, isActive: data.isActive === true };
  },

  async findLoginByEmail(email) {
    try {
      const user = await (await adminAuth()).getUserByEmail(email);
      return { externalUid: user.uid, displayName: typeof user.displayName === "string" ? user.displayName : null };
    } catch (error) {
      // No login with this email: the person is new. Any other failure (an outage) is the server's and answers 500.
      if (errorCode(error) === "auth/user-not-found") return null;
      throw error;
    }
  },

  async createLogin({ email, displayName }) {
    try {
      const user = await (await adminAuth()).createUser({ email, displayName, emailVerified: false, disabled: false });
      return { externalUid: user.uid };
    } catch (error) {
      // An email Firebase refuses is the form's to fix (400 on the email field), not a server failure: someone who
      // signed in before, a legacy account (C-62), or a retry after a partial onboarding. Nothing was written yet.
      const code = errorCode(error);
      if (code === "auth/email-already-exists") {
        throw new SevaError("validation", { field: "email", message: "This email already has a sign-in account." });
      }
      if (code === "auth/invalid-email") {
        throw new SevaError("validation", { field: "email", message: "This email address is not valid." });
      }
      throw error;
    }
  },

  async setAccessProfile(externalUid, patch) {
    const { FieldValue } = await import("firebase-admin/firestore");
    const write: Record<string, unknown> = { uid: externalUid };
    if (patch.role !== undefined) write.role = patch.role;
    if (patch.isActive !== undefined) write.isActive = patch.isActive;
    if (patch.email !== undefined) write.email = patch.email;
    // The site's profile keeps the display name in `name` (lib/auth/sign-in-profile.ts).
    if (patch.displayName !== undefined) write.name = patch.displayName;
    write.updatedAt = FieldValue.serverTimestamp();
    await (await userDoc(externalUid)).set(write, { merge: true });
  },

  async setLoginEnabled(externalUid, enabled) {
    const auth = await adminAuth();
    await auth.updateUser(externalUid, { disabled: !enabled });
    if (!enabled) await auth.revokeRefreshTokens(externalUid);
  },

  async deleteLogin(externalUid) {
    try {
      await (await adminAuth()).deleteUser(externalUid);
    } catch (error) {
      // Already gone counts as deleted, so a retried delete succeeds.
      if (errorCode(error) === "auth/user-not-found") return;
      throw error;
    }
  },
};
