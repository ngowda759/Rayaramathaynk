import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

import { requireAdminCapability } from "@/lib/auth/admin-capabilities";
import { listLocalAssets, resolveLocalAssetPath } from "@/lib/gallery/local-assets";

/**
 * Local gallery assets under `public/images/temple/` and `public/videos/`.
 *
 * GET requires `gallery.read`; DELETE requires `gallery.delete`. The containment
 * rules live in `lib/gallery/local-assets.ts`: they reject traversal, absolute
 * paths, symlinks and any file outside the two roots.
 */

function publicRoot(): string {
  return path.resolve(process.cwd(), "public");
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminCapability(request, "gallery.read");
  if (!auth.ok) return auth.response;
  return NextResponse.json(listLocalAssets(publicRoot()));
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminCapability(request, "gallery.delete");
  if (!auth.ok) return auth.response;

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
