import { NextResponse } from "next/server";

import { getAaradhaneYearDataset } from "@/lib/data-flows/server";
import { isValidYear } from "@/lib/data-flows/time";

export const runtime = "nodejs";

/** Generated Aaradhane dataset for a specific year. */
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

  const result = await getAaradhaneYearDataset(year);
  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : 404,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
