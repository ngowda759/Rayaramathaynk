import { NextResponse } from "next/server";

import { getCurrentPanchanga } from "@/lib/data-flows/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Today's Panchanga, read from Supabase Storage.
 *
 * `status` is one of `ok`, `stale` or `unavailable`:
 *   - `ok` is the record for the current Asia/Kolkata day.
 *   - `stale` retains the last published record but explicitly marks it as not
 *     today's data, so a caller cannot mistake it for current.
 *   - `unavailable` means Storage could not be reached or the object is invalid.
 */
export async function GET() {
  const result = await getCurrentPanchanga();
  return NextResponse.json(result, {
    status: result.status === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
