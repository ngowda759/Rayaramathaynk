// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { userService } from "@/services/user.server";

/**
 * The directory is deny-all under RLS and carries role/activation state, so every
 * operation reads and writes through the service-role Supabase client
 * (`services/user.server`). Never import the browser client
 * (`services/user.service`) here: it resolves `/api/admin/users` relatively, so the
 * route would call itself and fail on a server runtime.
 *
 * GET /api/admin/users - List all admin users.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  try {
    const users = await userService.getUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error("[admin/users] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

/**
 * POST /api/admin/users - Create a new admin user.
 * Expected body: { email, password, name, role, active }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  try {
    const user = await request.json();
    const id = await userService.addUser(user);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[admin/users] POST failed:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/users - Update an existing user. The id travels in the body.
 * Prefer `PUT /api/admin/users/:id`, which the browser client uses.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  try {
    const { id, ...updates } = await request.json();
    await userService.updateUser(id, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/users] PUT failed:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users - Delete a user. The id travels in the body.
 * Prefer `DELETE /api/admin/users/:id`, which the browser client uses.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await request.json();
    await userService.deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/users] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
