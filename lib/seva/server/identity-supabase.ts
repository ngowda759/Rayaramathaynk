/**
 * Supabase implementation of the seva identity adapter:
 * - Supabase Auth for logins and sessions
 * - Supabase `public.users` for access profiles (role and active flag)
 *
 * Implements IdentityAdapter (lib/seva/server/identity.ts).
 * Zero Firestore runtime dependencies.
 */

import "server-only";
import { checkBearerIdToken } from "@/lib/auth/verify-id-token";
import { SevaError } from "@/lib/seva/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/supabase/identifier";
import type { IdentityAdapter } from "./identity";

export const supabaseIdentityAdapter: IdentityAdapter = {
  async verifyRequest(req) {
    const result = await checkBearerIdToken(req, { checkRevoked: true });
    if (result.status === "unavailable") {
      throw new SevaError("internal");
    }
    if (result.status !== "ok") {
      return null;
    }
    return { externalUid: result.caller.uid, email: result.caller.email };
  },

  async getAccessProfile(externalUid) {
    const supabase = createAdminClient();
    const filterQuery = isUuid(externalUid)
      ? `auth_user_id.eq.${externalUid},id.eq.${externalUid},firestore_id.eq.${externalUid}`
      : `firestore_id.eq.${externalUid}`;

    const { data, error } = await supabase
      .from("users")
      .select("role, active")
      .or(filterQuery)
      .maybeSingle();

    if (error) {
      console.error("[identity-supabase] getAccessProfile error:", error.message);
      throw new SevaError("internal");
    }

    if (!data) return null;

    const row = data as { role?: unknown; active?: boolean | null };
    return {
      role: row.role,
      isActive: row.active !== false,
    };
  },

  async findLoginByEmail(email) {
    try {
      const supabase = createAdminClient();
      const normalizedEmail = email.trim().toLowerCase();

      // Check Supabase Auth Admin first
      const adminAuth = (supabase.auth as any)?.admin;
      if (typeof adminAuth?.getUserByEmail === "function") {
        const { data, error } = await adminAuth.getUserByEmail(normalizedEmail);
        if (!error && data?.user) {
          return {
            externalUid: data.user.id,
            displayName:
              data.user.user_metadata?.name ||
              data.user.user_metadata?.displayName ||
              null,
            emailVerified: !!data.user.email_confirmed_at,
            disabled: !!data.user.banned_until,
          };
        }
      }

      if (typeof adminAuth?.listUsers === "function") {
        const { data, error } = await adminAuth.listUsers();
        if (!error && Array.isArray(data?.users)) {
          const matched = data.users.find(
            (u: any) => u.email?.trim().toLowerCase() === normalizedEmail
          );
          if (matched) {
            return {
              externalUid: matched.id,
              displayName:
                matched.user_metadata?.name ||
                matched.user_metadata?.displayName ||
                null,
              emailVerified: !!matched.email_confirmed_at,
              disabled: !!matched.banned_until,
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error("[identity-supabase] findLoginByEmail failed:", error);
      throw new SevaError("internal");
    }
  },

  async createLogin({ email, displayName }) {
    try {
      const supabase = createAdminClient();
      const adminAuth = (supabase.auth as any)?.admin;

      if (typeof adminAuth?.createUser !== "function") {
        throw new SevaError("internal");
      }

      const { data, error } = await adminAuth.createUser({
        email: email.trim().toLowerCase(),
        user_metadata: {
          name: displayName,
          displayName,
        },
        email_confirm: false,
      });

      if (error) {
        if (/already registered|already in use/i.test(error.message || "")) {
          throw new SevaError("validation", {
            field: "email",
            message: "This email already has a sign-in account.",
          });
        }
        throw new SevaError("internal");
      }

      if (!data?.user?.id) {
        throw new SevaError("internal");
      }

      return { externalUid: data.user.id };
    } catch (error) {
      if (error instanceof SevaError) throw error;
      throw new SevaError("internal");
    }
  },

  async setAccessProfile(externalUid, patch) {
    const supabase = createAdminClient();
    const updateData: Record<string, unknown> = {};

    if (patch.role !== undefined) updateData.role = patch.role;
    if (patch.isActive !== undefined) updateData.active = patch.isActive;
    if (patch.email !== undefined) updateData.email = patch.email;
    if (patch.displayName !== undefined) updateData.display_name = patch.displayName;
    updateData.updated_at = new Date().toISOString();

    const filterCol = isUuid(externalUid) ? "auth_user_id" : "firestore_id";

    const { data: existing, error: findError } = await supabase
      .from("users")
      .select("id")
      .eq(filterCol, externalUid)
      .maybeSingle();

    if (findError) {
      console.error("[identity-supabase] setAccessProfile lookup failed:", findError.message);
      throw new SevaError("internal");
    }

    if (existing) {
      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", existing.id);

      if (error) {
        console.error("[identity-supabase] setAccessProfile update failed:", error.message);
        throw new SevaError("internal");
      }
    } else {
      const { error } = await supabase
        .from("users")
        .insert({
          ...updateData,
          [filterCol]: externalUid,
          active: patch.isActive !== undefined ? patch.isActive : true,
          role: patch.role || "devotee",
        });

      if (error) {
        console.error("[identity-supabase] setAccessProfile insert failed:", error.message);
        throw new SevaError("internal");
      }
    }
  },

  async setLoginEnabled(externalUid, enabled) {
    try {
      const supabase = createAdminClient();
      const adminAuth = (supabase.auth as any)?.admin;
      if (typeof adminAuth?.updateUserById === "function") {
        await adminAuth.updateUserById(externalUid, {
          ban_duration: enabled ? "none" : "876000h",
        });
      }
    } catch (error) {
      console.error("[identity-supabase] setLoginEnabled failed:", error);
      throw new SevaError("internal");
    }
  },

  async deleteLogin(externalUid) {
    try {
      const supabase = createAdminClient();
      const adminAuth = (supabase.auth as any)?.admin;
      if (typeof adminAuth?.deleteUser === "function") {
        await adminAuth.deleteUser(externalUid);
      }
    } catch (error) {
      console.error("[identity-supabase] deleteLogin failed:", error);
      throw new SevaError("internal");
    }
  },
};
