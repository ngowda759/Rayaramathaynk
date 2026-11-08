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
    user: any;
    session: any;
  };
  error?: any;
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
          phone,
        },
      },
    });

    if (error) {
      throw error;
    }

    // Try to ensure public.users profile is provisioned
    try {
      if (typeof window !== "undefined") {
        await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, phone, userId: data.user?.id }),
        }).catch(() => {
          // Non-blocking in case offline or handled by email confirmation callback
        });
      }
    } catch {
      // Ignored
    }

    return { data };
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

    return { data };
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
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : "/reset-password";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      throw error;
    }
  }

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    // In server environment or unit tests, query via createAdminClient
    if (typeof window === "undefined" || process.env.NODE_ENV === "test") {
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const supabase = createAdminClient();
        const { data, error } = await supabase
          .from("users")
          .select("id, auth_user_id, firestore_id, email, display_name, phone_number, role, active, created_at, updated_at")
          .or(`auth_user_id.eq.${uid},firestore_id.eq.${uid},id.eq.${uid}`)
          .maybeSingle();

        if (error || !data) return null;

        const row = data as Record<string, unknown>;
        return {
          uid: String(row.auth_user_id || row.firestore_id || row.id),
          name: String(row.display_name || row.email || "").split("@")[0],
          email: String(row.email || ""),
          phone: row.phone_number ? String(row.phone_number) : undefined,
          role: (row.role as any) || "devotee",
          isActive: row.active !== false,
          isApproved: false,
          createdAt: row.created_at as any,
          updatedAt: row.updated_at as any,
        };
      } catch (err) {
        console.error("[authService] getUserProfile server read failed:", err);
        return null;
      }
    }

    // In browser environment, query via authenticated API route
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

      if (!res.ok) {
        return null;
      }

      return (await res.json()) as UserProfile;
    } catch (err) {
      console.error("[authService] getUserProfile client fetch failed:", err);
      return null;
    }
  }

  currentUser() {
    if (typeof window === "undefined") return null;
    const supabase = createClient();
    let user: any = null;
    supabase.auth.getSession().then(({ data }) => {
      user = data.session?.user ?? null;
    }).catch(() => {
      user = null;
    });
    return user;
  }
}

export const authService = new AuthService();
