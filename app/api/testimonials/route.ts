import { NextRequest, NextResponse } from "next/server";

import { allowPublicWrite } from "@/lib/api/public-rate-limit";
import { chatTestimonialSchema } from "@/lib/validation/public-submissions";
import { parseJsonBody } from "@/lib/validation/http";
import { getApprovedTestimonials, submitTestimonial } from "@/services/chat.server";

/**
 * GET  /api/testimonials - approved AI-chat testimonials (public read).
 * POST /api/testimonials - public submission for review.
 *
 * `approved` is never taken from the body: `submitTestimonial` always inserts with
 * `approved: false`, so a caller cannot publish their own testimonial. The body is
 * validated (bounded name/experience, rating 1-5) before the service runs.
 */
export async function POST(request: NextRequest) {
  if (!allowPublicWrite(request, { scope: "testimonials:create", limit: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, chatTestimonialSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const testimonialId = await submitTestimonial(parsed.data);
    return NextResponse.json({
      success: true,
      id: testimonialId,
      message: "Thank you for sharing your experience! Your testimonial will be reviewed by our team.",
    });
  } catch (error) {
    console.error("Testimonial submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit testimonial. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const testimonials = await getApprovedTestimonials();
    return NextResponse.json({ testimonials });
  } catch (error) {
    console.error("Get testimonials error:", error);
    return NextResponse.json({ error: "Failed to fetch testimonials" }, { status: 500 });
  }
}
