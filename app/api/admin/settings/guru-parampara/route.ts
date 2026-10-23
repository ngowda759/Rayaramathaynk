import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import {
  computeRevision,
  GuruParamparaConflictError,
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
 *
 * The GET response carries the document's `revision`, and PUT requires it back
 * (`expectedRevision`). That pairing is what stops a page that loaded the
 * built-in defaults — because the `settings_documents` row does not exist yet —
 * from saving those defaults over live content: with no row the revision is
 * `absent`, and a create is refused unless `allowCreate` is set.
 */

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const { data, revision } = await guruParamparaService.getWithRevision();
    return NextResponse.json({ success: true, data, revision });
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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { success: false, error: "Request body must be a JSON object" },
      { status: 400 },
    );
  }

  const { expectedRevision, data } = body as {
    expectedRevision?: unknown;
    data?: unknown;
  };

  // `allowCreate` is deliberately not accepted from the request body: creating the
  // row is an owner-gated operation, not something an admin can opt into per call.
  try {
    const saved = await guruParamparaService.save(data, {
      expectedRevision: typeof expectedRevision === "string" ? expectedRevision : "",
    });
    // Return the new revision so the client can save again without reloading.
    return NextResponse.json({
      success: true,
      data: saved,
      revision: computeRevision(saved),
    });
  } catch (error) {
    if (error instanceof GuruParamparaConflictError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
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
