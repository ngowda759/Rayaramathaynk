/**
 * Firebase implementation of the seva identity adapter: Firebase Auth for logins, Supabase `users` table for the
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

async function supabaseClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

function errorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

export const firebaseIdentityAdapter: IdentityAdapter = {
  async verifyRequest(req) {
    const result = await checkBearerIdToken(req, { checkRevoked: true });
    if (result.status === "unavailable") throw new SevaError("internal");
    if (result.status !== "ok") return null;
    return { externalUid: result.caller.uid, email: result.caller.email };
  },

  async getAccessProfile(externalUid) {
    const supabase = await supabaseClient();
    const { data, error } = await supabase
      .from("users")
      .select("role, active")
      .or(`firestore_id.eq.${externalUid},auth_user_id.eq.${externalUid}`)
      .maybeSingle();

    if (error || !data) return null;
    return { role: data.role, isActive: data.active === true };
  },

  async findLoginByEmail(email) {
    try {
      const user = await (await adminAuth()).getUserByEmail(email);
      return {
        externalUid: user.uid,
        displayName: typeof user.displayName === "string" ? user.displayName : null,
        emailVerified: user.emailVerified === true,
        disabled: user.disabled !== false,
      };
    } catch (error) {
      if (errorCode(error) === "auth/user-not-found") return null;
      throw error;
    }
  },

  async createLogin({ email, displayName }) {
    try {
      const user = await (await adminAuth()).createUser({ email, displayName, emailVerified: false, disabled: false });
      return { externalUid: user.uid };
    } catch (error) {
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
    const supabase = await supabaseClient();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.role !== undefined) update.role = patch.role;
    if (patch.isActive !== undefined) update.active = patch.isActive;
    if (patch.email !== undefined) update.email = patch.email;
    if (patch.displayName !== undefined) update.name = patch.displayName;

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .or(`firestore_id.eq.${externalUid},auth_user_id.eq.${externalUid}`)
      .maybeSingle();

    if (existing) {
      await supabase.from("users").update(update).eq("id", existing.id);
    } else {
      await supabase.from("users").insert({
        firestore_id: externalUid,
        ...update,
        created_at: new Date().toISOString(),
      });
    }
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
      if (errorCode(error) === "auth/user-not-found") return;
      throw error;
    }
  },
};
