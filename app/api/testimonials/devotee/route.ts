import { NextRequest, NextResponse } from "next/server";

import { createTestimonial, getApprovedTestimonials } from "@/services/testimonial.server";

/** Public devotee testimonials: read approved, submit a new one for review. */
export async function GET() {
  try {
    return NextResponse.json(await getApprovedTestimonials());
  } catch (error) {
    console.error("[testimonials/devotee] read failed:", error);
    return NextResponse.json({ error: "Failed to read testimonials" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body?.name || !body?.quote) {
      return NextResponse.json({ error: "Name and quote are required" }, { status: 400 });
    }
    const id = await createTestimonial({
      name: String(body.name),
      location: String(body.location ?? ""),
      quote: String(body.quote),
      years: "Devotee",
      image: body.image || undefined,
      phone: body.phone || undefined,
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
