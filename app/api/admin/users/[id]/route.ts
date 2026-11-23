// app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireAdminCapability } from "@/lib/auth/admin-capabilities";
import { userService } from "@/services/user.server";

/**
 * One directory record, addressed by the id the list returns (`firestore_id` when the
 * row carries one, its primary key otherwise — see `lib/supabase/identifier.ts`).
 *
 * Read-only (AUTHZ-01). The update and delete verbs were retired because they wrote a
 * client-supplied `role`/`active` with the service-role client. Role and status changes go
 * through the staff module (`PUT /api/seva/staff/[id]`), which enforces the DB §3.3 matrix
 * and records an audit row.
 */

/**
 * GET /api/admin/users/:id - Read one user, or 404.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminCapability(request, "users.directory.read");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const user = await userService.getUser(id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json(user);
  } catch (error) {
    console.error("[admin/users/:id] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}
