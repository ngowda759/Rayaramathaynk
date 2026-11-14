// app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { userService } from "@/services/user.server";

/**
 * One directory record, addressed by the id the list returns (`firestore_id` when the
 * row carries one, its primary key otherwise — see `lib/supabase/identifier.ts`).
 *
 * The browser client (`services/user.service`) calls this endpoint for its get/update/
 * delete operations, so the id it holds round-trips here. The record is read and
 * written through the service-role Supabase client only; the guard is the same
 * `requireAdminUser` check the collection route uses.
 */

/**
 * GET /api/admin/users/:id - Read one user, or 404.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
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

/**
 * PUT /api/admin/users/:id - Update one user. The id comes from the path.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const updates = await request.json();
    await userService.updateUser(id, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/users/:id] PUT failed:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/:id - Delete one user. The id comes from the path.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await userService.deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/users/:id] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
