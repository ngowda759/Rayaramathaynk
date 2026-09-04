/**
 * Server-only admin authentication for admin API routes.
 *
 * Verifies the Firebase ID token sent by the admin UI (Authorization: Bearer)
 * using the Firebase Admin SDK and checks the user's role in Firestore.
 * Public/unauthenticated callers are rejected.
 */

import "server-only";
import type { NextRequest } from "next/server";

export interface ServerAdminUser {
  uid: string;
  email: string;
  role: string;
}

const BLOCKED_ROLES = new Set(["devotee", "volunteer"]);

function normalizeRole(role: unknown): string {
  return String(role || "").toLowerCase().replace(/\s+/g, "_");
}

/**
 * Verify the caller is an authorized admin. Returns null when unauthenticated,
 * not an admin, or the token cannot be verified.
 */
export async function verifyAdminUser(
  request: NextRequest
): Promise<ServerAdminUser | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) {
    return null;
  }

  try {
    const { getAuth } = await import("firebase-admin/auth");
    const decoded = await getAuth().verifyIdToken(idToken);
    const { getFirestore } = await import("firebase-admin/firestore");
    const db = getFirestore();

    const userSnap = await db.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists) {
      return null;
    }

    const data = userSnap.data() || {};
    if (data.isActive === false) {
      return null;
    }

    const role = normalizeRole(data.role);
    if (BLOCKED_ROLES.has(role)) {
      return null;
    }

    return {
      uid: decoded.uid,
      email: String(data.email || decoded.email || ""),
      role,
    };
  } catch (error) {
    console.error("[verifyAdminUser] Failed to verify admin token:", error);
    return null;
  }
}