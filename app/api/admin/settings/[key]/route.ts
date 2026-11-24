import { NextRequest, NextResponse } from "next/server";

import { requireAdminCapability, type AdminCapability } from "@/lib/auth/admin-capabilities";
import { requireAdminUser } from "@/lib/auth/admin-auth";
import {
  getSettingsDocument,
  isSettingsDocumentKey,
  saveSettingsDocument,
  type SettingsDocumentKey,
} from "@/services/settings-document.service";

/**
 * Documents only a super admin may write. `financeSettings` carries the
 * counter's UPI payee (docs/SECURITY.md §"Counter UPI id"); `device` carries
 * device-security configuration.
 */
const SUPER_ADMIN_ONLY_SETTINGS: ReadonlySet<string> = new Set(["financeSettings", "device"]);

/** Roles that may write the remaining settings documents (docs/ADMIN-GUIDELINES.md). */
const SETTINGS_WRITE_ROLES: ReadonlySet<string> = new Set(["super_admin", "temple_admin", "admin"]);

/**
 * The capability a reader needs, per document key. `device` is super-admin-only;
 * the counter's finance document needs the finance read; every other document is
 * general settings. Keys not listed fall back to general settings.
 */
const SETTINGS_READ_CAPABILITY: Partial<Record<SettingsDocumentKey, AdminCapability>> = {
  financeSettings: "settings.finance.read",
  device: "settings.device.read",
};
const DEFAULT_SETTINGS_READ_CAPABILITY: AdminCapability = "settings.general.read";

/**
 * Admin read/write for a website settings document.
 *
 * Replaces the direct browser `getDoc`/`setDoc` calls the settings admin pages made
 * against the Firestore `settings` collection. `settings_documents` is deny-all under
 * RLS, so both handlers use the service-role client inside the service.
 *
 * Reads are capability-checked per document: `device` is super-admin-only, the counter
 * finance document needs `settings.finance.read`, and everything else needs
 * `settings.general.read`. Writes keep the existing role checks below.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const capability = isSettingsDocumentKey(key)
    ? (SETTINGS_READ_CAPABILITY[key] ?? DEFAULT_SETTINGS_READ_CAPABILITY)
    : DEFAULT_SETTINGS_READ_CAPABILITY;

  const auth = await requireAdminCapability(request, capability);
  if (!auth.ok) return auth.response;

  if (!isSettingsDocumentKey(key)) {
    return NextResponse.json({ error: "Unknown settings document" }, { status: 404 });
  }

  try {
    const data = await getSettingsDocument(key);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(`[API] Error reading ${key} settings:`, error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  const { key } = await params;
  if (!isSettingsDocumentKey(key)) {
    return NextResponse.json({ error: "Unknown settings document" }, { status: 404 });
  }
  if (SUPER_ADMIN_ONLY_SETTINGS.has(key)) {
    if (auth.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!SETTINGS_WRITE_ROLES.has(auth.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  try {
    await saveSettingsDocument(key, body as Record<string, unknown>);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API] Error saving ${key} settings:`, error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
