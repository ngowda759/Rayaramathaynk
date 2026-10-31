import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { donationService } from "@/services/donation.server";

/**
 * Donation reads and edits are administrative: `donations` is deny-all under RLS and
 * carries donor contact and payment details. The admin console uses the guarded
 * `/api/admin/donations` routes; these aliases are kept for compatibility but are
 * guarded with the same `requireAdminUser` check.
 *
 * Before this guard existed, anyone could read a donation by id (exposing donor
 * contact details), overwrite it, or delete it.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const donation = await donationService.getDonationById(id);
    if (!donation) return NextResponse.json({ error: "Donation not found" }, { status: 404 });
    return NextResponse.json(donation);
  } catch (error) {
    console.error("[API] Error fetching donation:", error);
    return NextResponse.json({ error: "Failed to fetch donation" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    await donationService.updateDonation(id, body);
    return NextResponse.json({ message: "Donation updated successfully" });
  } catch (error) {
    console.error("[API] Error updating donation:", error);
    return NextResponse.json({ error: "Failed to update donation" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await donationService.deleteDonation(id);
    return NextResponse.json({ message: "Donation deleted successfully" });
  } catch (error) {
    console.error("[API] Error deleting donation:", error);
    return NextResponse.json({ error: "Failed to delete donation" }, { status: 500 });
  }
}
