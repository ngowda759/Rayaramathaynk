import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { createTestimonial, getAllTestimonials, getPendingTestimonials } from "@/services/testimonial.server";

/** Admin devotee testimonial list (`?pending=1` for the review queue) and creation. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  try {
    const pending = request.nextUrl.searchParams.get("pending") === "1";
    return NextResponse.json(pending ? await getPendingTestimonials() : await getAllTestimonials());
  } catch (error) {
    console.error("[admin/testimonials] read failed:", error);
    return NextResponse.json({ error: "Failed to read testimonials" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const id = await createTestimonial({ ...body, submittedBy: body.submittedBy || "admin" });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[admin/testimonials] create failed:", error);
    return NextResponse.json({ error: "Failed to create testimonial" }, { status: 500 });
  }
}
