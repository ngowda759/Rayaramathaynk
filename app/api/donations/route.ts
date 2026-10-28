import { NextRequest, NextResponse } from "next/server";

import { donationService } from "@/services/donation.server";
import type { DonationRequest } from "@/types/donation";

/** Public donation submission. The admin list lives at `/api/admin/donations`. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DonationRequest;
    if (!body?.amount || body.amount <= 0) {
      return NextResponse.json({ error: "A valid amount is required" }, { status: 400 });
    }
    if (!body.donorName) {
      return NextResponse.json({ error: "Donor name is required" }, { status: 400 });
    }
    const id = await donationService.createDonation(body);
    return NextResponse.json({ id, message: "Donation recorded successfully" }, { status: 201 });
  } catch (error) {
    console.error("[donations] create failed:", error);
    return NextResponse.json({ error: "Failed to record donation" }, { status: 500 });
  }
}
