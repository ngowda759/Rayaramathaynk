import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { allowPublicWrite } from "@/lib/api/public-rate-limit";
import { donationAdminUpdateSchema } from "@/lib/validation/public-submissions";
import { parseJsonBody } from "@/lib/validation/http";
import { donationService } from "@/services/donation.server";

/**
 * Donation reads and edits are administrative: `donations` is deny-all under RLS and
 * carries donor contact and payment details. The admin console uses the guarded
 * `/api/admin/donations` routes; these aliases are kept for compatibility but are
 * guarded with the same `requireAdminUser` check.
 *
 * Before this guard existed, anyone could read a donation by id (exposing donor
 * contact details), overwrite it, or delete it. The PATCH body is now validated
 * against an allow-list, so an admin request cannot store a malformed value or
 * smuggle a column the update does not support.
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

  if (!allowPublicWrite(request, { scope: "donations:update", identity: auth.user.uid, limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, donationAdminUpdateSchema);
  if (!parsed.ok) return parsed.response;

  const { id } = await params;
  try {
    // `status` alone goes through the status path so the collection timestamp is kept in sync.
    if (parsed.data.status && Object.keys(parsed.data).length === 1) {
      await donationService.updateDonationStatus(id, parsed.data.status);
    } else {
      await donationService.updateDonation(id, parsed.data);
    }
    return NextResponse.json({ message: "Donation updated successfully" });
  } catch (error) {
    console.error("[API] Error updating donation:", error);
    return NextResponse.json({ error: "Failed to update donation" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  if (!allowPublicWrite(request, { scope: "donations:delete", identity: auth.user.uid, limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await params;
  try {
    await donationService.deleteDonation(id);
    return NextResponse.json({ message: "Donation deleted successfully" });
  } catch (error) {
    console.error("[API] Error deleting donation:", error);
    return NextResponse.json({ error: "Failed to delete donation" }, { status: 500 });
  }
}
