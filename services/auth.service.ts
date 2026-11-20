import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/types/user";

export interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface SupabaseAuthResult {
  data: {
    user: unknown;
    session: unknown;
  };
  error?: unknown;
  /**
   * Outcome of the post-signUp provisioning call. `pending` means the identity
   * still has to confirm its email, so no profile row exists yet (it is created
   * by /api/auth/me once the address is verified); `provisioned` means the
   * devotee row now exists.
   */
  provisioning?: "provisioned" | "pending";
}

class AuthService {
  async register({
    name,
    email,
    phone,
    password,
  }: RegisterData): Promise<SupabaseAuthResult> {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          full_name: name,
          phone,
        },
      },
    });

    if (error) {
      throw error;
    }

    // An identity that has not confirmed its email cannot be provisioned: the
    // server refuses to create a row until ownership is proven, so calling it
    // here would only surface an error the person cannot act on. The row is
    // created later by /api/auth/me once the session is verified.
    const signedUpUser = data.user as
      | { id?: string; email_confirmed_at?: string | null; confirmed_at?: string | null }
      | undefined;
    const userId = signedUpUser?.id;
    const confirmedAt = signedUpUser?.email_confirmed_at ?? signedUpUser?.confirmed_at ?? null;

    if (!userId || !confirmedAt) {
      return { data, error, provisioning: "pending" };
    }

    // Call user self-provisioning endpoint to guarantee public.users row exists
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email,
          name,
          phone,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = errBody?.error || `Profile synchronization failed (${res.status})`;
        console.error("[authService] register backend sync failed:", msg);
        throw new Error(msg);
      }
    } catch (err) {
      console.error("[authService] register backend sync failed:", err);
      throw err;
    }

    return { data, error, provisioning: "provisioned" };
  }

  async login(
    email: string,
    password: string
  ): Promise<SupabaseAuthResult> {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return { data, error };
  }

  async logout(): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[authService] logout error:", error);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/admin/ai/reset-password` : undefined,
    });

    if (error) {
      throw error;
    }
  }

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    // 1. In browser with fetch available, query through authoritative API route
    if (typeof window !== "undefined" && typeof fetch === "function" && process.env.NODE_ENV !== "test") {
      try {
        const supabase = createClient();
        const sessionResult = await supabase.auth.getSession();
        const session = sessionResult?.data?.session;
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        const res = await fetch("/api/auth/me", {
          method: "GET",
          headers,
          credentials: "include",
        });

        if (res.ok) {
          return (await res.json()) as UserProfile;
        }
      } catch (err) {
        console.warn("[authService] getUserProfile client fetch fallback:", err);
      }
    }

    // 2. Client SDK query (used in unit tests and as a server-side fallback). `uid` is a Supabase
    //    Auth UUID, so the row is matched on `auth_user_id` only: a row whose `id` equals the Auth
    //    UID was never linked, and matching it here would hand back a profile the caller does not own.
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .select("id, auth_user_id, email, display_name, phone_number, role, active, created_at, updated_at")
        .eq("auth_user_id", uid)
        .maybeSingle();

      if (error || !data) return null;

      const row = data as Record<string, unknown>;
      return {
        uid: String(row.auth_user_id || row.id),
        name: String(row.display_name || row.email || "").split("@")[0],
        email: String(row.email || ""),
        phone: row.phone_number ? String(row.phone_number) : "",
        role: (row.role as any) || "devotee",
        templeId: "main",
        profileImage: "",
        isApproved: false,
        isActive: row.active !== false,
        emailVerified: false,
        lastLogin: null,
        createdAt: row.created_at as any,
        updatedAt: row.updated_at as any,
      };
    } catch (err) {
      console.error("[authService] getUserProfile query failed:", err);
      return null;
    }
  }

  currentUser() {
    if (typeof window === "undefined") return null;
    const supabase = createClient();
    let user: unknown = null;
    supabase.auth.getSession().then(({ data }) => {
      user = data.session?.user ?? null;
    }).catch(() => {
      user = null;
    });
    return user;
  }
}

export const authService = new AuthService();
