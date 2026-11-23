// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";

import { requireAdminCapability } from "@/lib/auth/admin-capabilities";
import { userService } from "@/services/user.server";

/**
 * The temple user directory — read-only (AUTHZ-01).
 *
 * This surface used to export POST/PUT/DELETE that wrote a client-supplied `role` (and
 * `active`) through the service-role client, gated only by `requireAdminCapability`. Any console
 * role could therefore grant `super_admin` to itself or to another account.
 *
 * Identity and privilege changes belong to the staff module, which checks the DB §3.3
 * matrix on the server and records an audit row: `POST/PUT /api/seva/staff`
 * (`requireStaffAdmin`), plus the legacy `set-role` and `create-admin` routes. No write verb
 * is exported here, so Next answers 405 and no request body is read.
 *
 * The directory is deny-all under RLS and carries role/activation state, so every read goes
 * through the service-role Supabase client (`services/user.server`). Never import the browser
 * client (`services/user.service`) here: it resolves `/api/admin/users` relatively, so the
 * route would call itself and fail on a server runtime.
 *
 * GET /api/admin/users - List all admin users.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminCapability(request, "users.directory.read");
  if (!auth.ok) return auth.response;
  try {
    const users = await userService.getUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error("[admin/users] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
