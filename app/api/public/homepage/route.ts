import { NextResponse } from "next/server";

import { homepageService } from "@/services/homepage.server";

/**
 * Public homepage configuration.
 *
 * `settings_documents` is deny-all under RLS, so the browser cannot read the
 * `homepage` document directly with the anon key. This unauthenticated route serves
 * only the homepage configuration (public website content), never any admin data, and
 * falls back to the built-in defaults when no document has been saved yet.
 */
export async function GET() {
  try {
    const homepage = await homepageService.getHomepage();
    return NextResponse.json(homepage);
  } catch (error) {
    console.error("[API] Error reading homepage settings:", error);
    return NextResponse.json({ error: "Failed to load homepage settings" }, { status: 500 });
  }
}
