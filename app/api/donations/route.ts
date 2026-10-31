import { NextRequest, NextResponse } from "next/server";

import { allowPublicWrite } from "@/lib/api/public-rate-limit";
import { donationCreateSchema } from "@/lib/validation/public-submissions";
import { parseJsonBody } from "@/lib/validation/http";
import { donationService } from "@/services/donation.server";

/**
 * POST /api/donations - public donation submission.
 *
 * The admin list lives at `/api/admin/donations`. The body is validated before the
 * service runs, so the amount, donor name and optional contact details are bounded
 * and only the fields a donor may set are accepted: the service forces `status` to
 * "pending" and the receipt/collection fields to empty, so a caller cannot record a
 * donation as already received.
 */
export async function POST(request: NextRequest) {
  if (!allowPublicWrite(request, { scope: "donations:create", limit: 20, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, donationCreateSchema);
  if (!parsed.ok) return parsed.response;

  const data = parsed.data;
  try {
    const id = await donationService.createDonation({
      donorName: (data.donorName ?? data.name)!,
      email: data.email,
      phone: data.phone,
      address: data.address,
      amount: data.amount,
      purpose: data.purpose,
      campaignId: data.campaignId,
      message: data.message,
      paymentMode: data.paymentMode,
    });
    return NextResponse.json({ id, message: "Donation recorded successfully" }, { status: 201 });
  } catch (error) {
    console.error("[donations] create failed:", error);
    return NextResponse.json({ error: "Failed to record donation" }, { status: 500 });
  }
}
