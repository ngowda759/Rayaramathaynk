import { NextRequest, NextResponse } from "next/server";

import { requireAdminCapability } from "@/lib/auth/admin-capabilities";
import { donationService } from "@/services/donation.server";

/** Admin donation list. `donations` is deny-all under RLS. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminCapability(request, "donations.read");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await donationService.getDonations());
  } catch (error) {
    console.error("[admin/donations] read failed:", error);
    return NextResponse.json({ error: "Failed to read donations" }, { status: 500 });
  }
}
