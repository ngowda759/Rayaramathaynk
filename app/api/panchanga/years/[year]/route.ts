import { NextResponse } from "next/server";

import { getYearlyPanchanga } from "@/lib/data-flows/server";
import { isValidYear } from "@/lib/data-flows/time";

export const runtime = "nodejs";

/** Complete yearly Panchanga dataset. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ year: string }> }
) {
  const { year: rawYear } = await params;
  const year = Number(rawYear);
  if (!isValidYear(year)) {
    return NextResponse.json(
      { status: "unavailable", error: "year must be a four-digit year" },
      { status: 400 }
    );
  }

  const result = await getYearlyPanchanga(year);
  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : 404,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
