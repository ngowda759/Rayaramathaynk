import { NextRequest, NextResponse } from "next/server";

import { allowPublicWrite } from "@/lib/api/public-rate-limit";
import { devoteeTestimonialSchema } from "@/lib/validation/public-submissions";
import { parseJsonBody } from "@/lib/validation/http";
import { createTestimonial, getApprovedTestimonials } from "@/services/testimonial.server";

/**
 * Public devotee testimonials: read approved, submit a new one for review.
 *
 * The submission is forced to `submittedBy: "public"`, `approved: false` and
 * `rejected: false` regardless of the body, so a caller cannot publish a testimonial
 * or masquerade as an administrator submission.
 */
export async function GET() {
  try {
    return NextResponse.json(await getApprovedTestimonials());
  } catch (error) {
    console.error("[testimonials/devotee] read failed:", error);
    return NextResponse.json({ error: "Failed to read testimonials" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!allowPublicWrite(request, { scope: "testimonials:devotee", limit: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, devoteeTestimonialSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const id = await createTestimonial({
      name: parsed.data.name,
      location: parsed.data.location,
      quote: parsed.data.quote,
      years: "Devotee",
      image: parsed.data.image || undefined,
      phone: parsed.data.phone || undefined,
      submittedBy: "public",
      approved: false,
      rejected: false,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[testimonials/devotee] submit failed:", error);
    return NextResponse.json({ error: "Failed to submit testimonial" }, { status: 500 });
  }
}
