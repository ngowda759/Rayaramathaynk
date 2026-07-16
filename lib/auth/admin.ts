/**
 * Admin Authentication Module
 * Provides admin-only route protection for API routes
 */

import { NextRequest } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface AdminUser {
  uid: string;
  role: string;
  email?: string;
}

/**
 * Check if the request is from an authenticated admin user
 * Returns admin user info if authorized, null otherwise
 */
export async function checkAdminAuth(
  request: NextRequest
): Promise<AdminUser | null> {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // For development without auth, allow if in dev mode
      if (process.env.NODE_ENV === "development") {
        return { uid: "dev-admin", role: "admin" };
      }
      return null;
    }

    const token = authHeader.split("Bearer ")[1];
    
    if (!token) {
      return null;
    }

    // Check for admin API key
    if (process.env.ADMIN_API_KEY && token === process.env.ADMIN_API_KEY) {
      return { uid: "api-admin", role: "admin" };
    }

    // In production, this should verify Firebase ID tokens
    // For now, require valid auth header with Bearer token
    if (token && token.length > 10) {
      return { uid: "authenticated-user", role: "user" };
    }
    
    return null;
  } catch (error) {
    console.error("Admin auth check failed:", error);
    return null;
  }
}

/**
 * Check if user has admin role by querying Firestore
 */
export async function isUserAdmin(uid: string): Promise<boolean> {
  if (!db) {
    return false;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    
    if (!userDoc.exists()) {
      return false;
    }

    const userData = userDoc.data();
    return userData?.role === "admin" && userData?.isActive === true;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}
