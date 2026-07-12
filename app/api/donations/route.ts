import { NextRequest, NextResponse } from "next/server";
import { donationService } from "@/services/donation.service";

export async function GET() {
  try {
    const donations = await donationService.getDonations();
    return NextResponse.json(donations);
  } catch (error) {
    console.error("[API] Error fetching donations:", error);
    return NextResponse.json({ error: "Failed to fetch donations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validation
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
    }
    
    const donationId = await donationService.createDonation(body);
    return NextResponse.json({ id: donationId, message: "Donation recorded successfully" }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating donation:", error);
    return NextResponse.json({ error: "Failed to create donation" }, { status: 500 });
  }
}
