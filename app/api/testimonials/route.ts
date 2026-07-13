import { NextRequest, NextResponse } from "next/server";
import { submitTestimonial, getApprovedTestimonials, getPendingTestimonials, approveTestimonial } from "@/services/chat.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, name, city, experience, rating, permissionToPublish } = body;

    // Validate required fields
    if (!name || !experience || rating === undefined) {
      return NextResponse.json(
        { error: "Name, experience, and rating are required" },
        { status: 400 }
      );
    }

    // Validate rating
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be a number between 1 and 5" },
        { status: 400 }
      );
    }

    const testimonialId = await submitTestimonial({
      sessionId: sessionId || "",
      name: name.trim(),
      city: city?.trim() || "",
      experience: experience.trim(),
      rating,
      permissionToPublish: permissionToPublish || false,
    });

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
    return NextResponse.json(
      { error: "Failed to fetch testimonials" },
      { status: 500 }
    );
  }
}
