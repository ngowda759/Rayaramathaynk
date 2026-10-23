import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import {
  GuruParamparaValidationError,
  guruParamparaService,
} from "@/services/guru-parampara.service";

/**
 * Guru Parampara settings API.
 *
 * `settings_documents` is deny-all under RLS, so this cannot be read or written
 * from the browser with the anon key. Both handlers are therefore guarded by
 * `requireAdminUser` and use the service-role client inside the service.
 *
 * This replaces the direct Firestore `getDoc`/`setDoc` calls that
 * `app/admin/settings/guru-parampara/page.tsx` previously made from the browser.
 * (`services/aaradhane.service.ts` still writes the separate `aaradhane` /
 * `aaradhanes` collections; that needs an RLS policy on `aaradhanes` and is
 * tracked as a PR-D4c follow-up, not part of this change.)
 */

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const data = await guruParamparaService.get();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[API] Error reading guru parampara settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load guru parampara settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  try {
    const data = await guruParamparaService.save(body);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof GuruParamparaValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error("[API] Error saving guru parampara settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save guru parampara settings" },
      { status: 500 },
    );
  }
}
