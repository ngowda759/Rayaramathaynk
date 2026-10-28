import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { homepageService } from "@/services/homepage.server";

/**
 * Homepage settings API (admin only).
 *
 * `settings_documents` is deny-all under RLS, so this cannot be read or written from
 * the browser with the anon key. Both handlers are guarded by `requireAdminUser` and
 * use the service-role client inside the service. This replaces the direct Firestore
 * `getDoc`/`setDoc` calls the homepage admin form previously made from the browser.
 */

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const homepage = await homepageService.getHomepage();
    return NextResponse.json({ success: true, data: homepage });
  } catch (error) {
    console.error("[API] Error reading homepage settings:", error);
    return NextResponse.json({ error: "Failed to load homepage settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    await homepageService.saveHomepage(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error saving homepage settings:", error);
    return NextResponse.json({ error: "Failed to save homepage settings" }, { status: 500 });
  }
}
