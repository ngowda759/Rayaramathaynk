import { NextResponse } from "next/server";

import { getDailyPanchanga } from "@/lib/data-flows/server";

export const runtime = "nodejs";

/** Historical daily Panchanga for `YYYY-MM-DD`. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const result = await getDailyPanchanga(date);
  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : 404,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
