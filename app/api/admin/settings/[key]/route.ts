import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import {
  getSettingsDocument,
  isSettingsDocumentKey,
  saveSettingsDocument,
} from "@/services/settings-document.service";

/**
 * Admin read/write for a website settings document.
 *
 * Replaces the direct browser `getDoc`/`setDoc` calls the settings admin pages made
 * against the Firestore `settings` collection. `settings_documents` is deny-all under
 * RLS, so both handlers are guarded by `requireAdminUser` and use the service-role
 * client inside the service. The authenticated admin token is the same one the
 * homepage and guru-parampara settings routes use.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  const { key } = await params;
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
