/**
 * Firebase implementation of the seva identity adapter: Firebase Auth for logins, Firestore `users/{uid}` for the
 * role and the active flag (DB §3.2). Firebase Admin modules load on first use, as in lib/auth/verify-id-token.ts.
 */

import "server-only";
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
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
    // ID token runs out.
    const caller = await verifyBearerIdToken(req, { checkRevoked: true });
    return caller ? { externalUid: caller.uid, email: caller.email } : null;
  },

  async getAccessProfile(externalUid) {
    const snapshot = await (await userDoc(externalUid)).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data() ?? {};
    // Only these two fields; never `email` (editable by the person). A missing or non-boolean isActive is inactive.
    return { role: data.role, isActive: data.isActive === true };
  },

  async createLogin({ email, displayName }) {
    const user = await (await adminAuth()).createUser({ email, displayName, emailVerified: false, disabled: false });
    return { externalUid: user.uid };
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
