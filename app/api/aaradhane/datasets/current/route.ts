import { NextResponse } from "next/server";

import { getCurrentAaradhaneDataset } from "@/lib/data-flows/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The most recently published generated Aaradhane dataset.
 *
 * This is separate from `/api/aaradhane`, which serves the manually maintained
 * `aaradhanes` table. Generated datasets and manual records are independent.
 */
export async function GET() {
  const result = await getCurrentAaradhaneDataset();
  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : 404,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
