import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { listLocalAssets, resolveLocalAssetPath } from "@/lib/gallery/local-assets";

/**
 * Local gallery assets under `public/images/temple/` and `public/videos/`.
 *
 * Both handlers require a verified admin console session. DELETE additionally
 * requires a gallery-write role. The containment rules live in
 * `lib/gallery/local-assets.ts`: they reject traversal, absolute paths,
 * symlinks and any file outside the two roots.
 *
 * GET is admin-only. The only in-repo caller is the admin gallery component, and
 * the listing names files the server is allowed to delete.
 */

// Replaced by `requireAdminCapability(request, "gallery.delete")` once the
// centralized capability model lands; until then the role set is explicit.
const GALLERY_ADMIN_ROLES: ReadonlySet<string> = new Set(["super_admin", "temple_admin", "admin"]);

function publicRoot(): string {
  return path.resolve(process.cwd(), "public");
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json(listLocalAssets(publicRoot()));
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  if (!GALLERY_ADMIN_ROLES.has(auth.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const resolved = resolveLocalAssetPath((body as { src?: unknown })?.src, publicRoot());
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  try {
    fs.unlinkSync(resolved.realPath);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
