import { NextRequest } from "next/server";
import { verifyAdminUser } from "./admin-auth";
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
  const admin = await verifyAdminUser(request);
  if (!admin) return null;
  return { uid: admin.uid, role: admin.role, email: admin.email };
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
