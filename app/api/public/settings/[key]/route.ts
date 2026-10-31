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
 * Two documents hold internal data the public site never renders, so they are
 * narrowed to an allow-listed projection before serialization (F-A15.2):
 * `financeSettings` drops the billing block (invoice counter, GSTIN, company
 * contact) and `device` drops the notification/calendar/share/QR defaults, keeping
 * only the temple location. See `lib/settings/public-projections.ts`.
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
  "device",
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
