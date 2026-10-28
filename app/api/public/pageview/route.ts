import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Records a single page view.
 *
 * `page_views` and `daily_page_stats` are deny-all under RLS, so the browser cannot
 * write them directly. This route accepts the anonymous page-view beacon and writes
 * with the service role. Only the fields the tracker sends are read; nothing is echoed.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const path = typeof body?.path === "string" ? body.path : null;
    if (!path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("page_views").insert({
      path,
      referrer: typeof body.referrer === "string" ? body.referrer : "direct",
      device_type: typeof body.deviceType === "string" ? body.deviceType : "desktop",
      language: typeof body.language === "string" ? body.language : "en",
      country: typeof body.country === "string" ? body.country : "unknown",
      visitor_id: typeof body.visitorId === "string" ? body.visitorId : null,
      view_date: new Date().toISOString().split("T")[0],
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[pageview] Failed to record page view:", error);
    // Tracking is best-effort: never break the page for a failed beacon.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
