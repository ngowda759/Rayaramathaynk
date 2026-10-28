import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { donationService } from "@/services/donation.server";
import type { DonationRecord, DonationStatus } from "@/types/donation";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const donation = await donationService.getDonationById(id);
  if (!donation) return NextResponse.json({ error: "Donation not found" }, { status: 404 });
  return NextResponse.json(donation);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const body = (await request.json()) as Partial<DonationRecord> & { status?: DonationStatus };
    if (body.status) {
      await donationService.updateDonationStatus(id, body.status);
    } else {
      await donationService.updateDonation(id, body);
    }
    return NextResponse.json({ message: "Donation updated" });
  } catch (error) {
    console.error("[admin/donations/:id] update failed:", error);
    return NextResponse.json({ error: "Failed to update donation" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await donationService.deleteDonation(id);
    return NextResponse.json({ message: "Donation deleted" });
  } catch (error) {
    console.error("[admin/donations/:id] delete failed:", error);
    return NextResponse.json({ error: "Failed to delete donation" }, { status: 500 });
  }
}
