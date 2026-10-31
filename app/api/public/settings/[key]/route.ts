import { NextRequest, NextResponse } from "next/server";

import { projectPublicSettingsDocument } from "@/lib/settings/public-projections";
import {
  getSettingsDocument,
  isSettingsDocumentKey,
} from "@/services/settings-document.service";

/**
 * Public read for a website settings document.
 *
 * `settings_documents` is deny-all under RLS, so the browser cannot read it with the
 * anon key. The published website settings (About Us, Facilities, Trust Committee,
 * Future Plans, Footer, Social Links, Pooja Schedule, Festival and Ekadashi
 * calendars, Shlokas) are public content, so this endpoint serves the stored document
 * with the service-role client on the server. It returns `data: null` when the row
 * does not exist yet, so the caller keeps its built-in defaults. There is no Firestore
 * path.
 *
 * Two documents are handled specially (F-A15.2): `financeSettings` is served
 * through an allow-listed projection that drops the billing block and inactive
 * special sevas (see `lib/settings/public-projections.ts`), and `device` is not
 * served at all — nothing in the public site reads a stored `device` document (the
 * map uses the built-in `DEFAULT_DEVICE_SETTINGS` location), so a request for it
 * returns 404.
 */

const PUBLIC_KEYS = new Set([
  "aboutUs",
  "facilities",
  "trustCommittee",
  "futurePlans",
  "poojaSchedule",
  "festivalCalendar",
  "ekadashiCalendar",
  "footer",
  "socialLinks",
  "shlokas",
  "financeSettings",
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  if (!isSettingsDocumentKey(key) || !PUBLIC_KEYS.has(key)) {
    return NextResponse.json({ error: "Unknown settings document" }, { status: 404 });
  }

  try {
    const data = await getSettingsDocument(key);
    return NextResponse.json({
      success: true,
      data: projectPublicSettingsDocument(key, data),
    });
  } catch (error) {
    console.error(`[API] Error reading ${key} settings:`, error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}
