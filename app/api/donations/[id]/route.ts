import { NextRequest, NextResponse } from "next/server";
import { donationService } from "@/services/donation.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const donation = await donationService.getDonationById(id);
    if (!donation) {
      return NextResponse.json({ error: "Donation not found" }, { status: 404 });
    }
    return NextResponse.json(donation);
  } catch (error) {
    console.error("[API] Error fetching donation:", error);
    return NextResponse.json({ error: "Failed to fetch donation" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    await donationService.updateDonation(id, body);
    return NextResponse.json({ message: "Donation updated successfully" });
  } catch (error) {
    console.error("[API] Error updating donation:", error);
    return NextResponse.json({ error: "Failed to update donation" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await donationService.deleteDonation(id);
    return NextResponse.json({ message: "Donation deleted successfully" });
  } catch (error) {
    console.error("[API] Error deleting donation:", error);
    return NextResponse.json({ error: "Failed to delete donation" }, { status: 500 });
  }
}
