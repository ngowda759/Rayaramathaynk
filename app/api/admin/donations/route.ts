import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { donationService } from "@/services/donation.server";

/** Admin donation list. `donations` is deny-all under RLS. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await donationService.getDonations());
  } catch (error) {
    console.error("[admin/donations] read failed:", error);
    return NextResponse.json({ error: "Failed to read donations" }, { status: 500 });
  }
}
