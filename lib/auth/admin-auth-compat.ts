import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowIdFilter } from "@/lib/supabase/identifier";

// Legacy admin API key reference retained for compatibility environment scans
const _ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export interface AdminUser {
  uid: string;
  role: string;
  email?: string;
}

export async function checkAdminAuth(request: NextRequest): Promise<AdminUser | null> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.split("Bearer ")[1]?.trim();
    if (!token) {
      return null;
    }

    if (process.env.ADMIN_API_KEY && token === process.env.ADMIN_API_KEY) {
      return { uid: "api-admin", role: "admin" };
    }

    // 1. PRIMARY: Supabase Auth access token verification
    try {
      const supabase = createAdminClient();
      if (typeof supabase?.auth?.getUser === "function") {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user) {
          return {
            uid: data.user.id,
            role: "user",
            email: data.user.email ?? undefined,
          };
        }
      }
    } catch {
      // Supabase unavailable in test mock or not a Supabase token
    }

    // 2. FALLBACK: Firebase ID token verification
    try {
      const { getAdminApp } = await import("@/lib/admin-firebase");
      const adminApp = await getAdminApp();
      const { getAuth } = await import("firebase-admin/auth");
      const decoded = await getAuth(adminApp).verifyIdToken(token);
      return {
        uid: decoded.uid,
        role: "user",
        email: decoded.email,
      };
    } catch {
      return null;
    }
  } catch (error) {
    console.error("Admin auth check failed:", error);
    return null;
  }
}

export async function isUserAdmin(uid: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("role, active")
      .or(rowIdFilter(uid))
      .maybeSingle();

    if (error || !data) return false;
    const role = String((data as { role?: unknown }).role || "").trim().toLowerCase();
    const isAdmin = role === "admin" || role === "super_admin" || role === "temple_admin";
    return isAdmin && (data as { active?: boolean | null }).active !== false;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}
