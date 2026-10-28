import { NextResponse } from "next/server";

import { aaradhaneService } from "@/services/aaradhane.server";

/** Public aaradhane list (temple festival content). */
export async function GET() {
  try {
    return NextResponse.json(await aaradhaneService.getAaradhanes());
  } catch (error) {
    console.error("[aaradhane] read failed:", error);
    return NextResponse.json({ error: "Failed to fetch aaradhanes" }, { status: 500 });
  }
}
