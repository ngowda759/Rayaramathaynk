import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import {
  approveTestimonial,
  deleteTestimonial,
  getTestimonial,
  rejectTestimonial,
  updateTestimonial,
} from "@/services/testimonial.server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const testimonial = await getTestimonial(id);
  if (!testimonial) return NextResponse.json({ error: "Testimonial not found" }, { status: 404 });
  return NextResponse.json(testimonial);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await updateTestimonial(id, await request.json());
    return NextResponse.json({ message: "Testimonial updated" });
  } catch (error) {
    console.error("[admin/testimonials/:id] update failed:", error);
    return NextResponse.json({ error: "Failed to update testimonial" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const body = (await request.json()) as { approved?: boolean; rejected?: boolean; rejectionReason?: string };
    if (body.approved) await approveTestimonial(id);
    if (body.rejected) await rejectTestimonial(id, body.rejectionReason);
    return NextResponse.json({ message: "Testimonial updated" });
  } catch (error) {
    console.error("[admin/testimonials/:id] patch failed:", error);
    return NextResponse.json({ error: "Failed to update testimonial" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await deleteTestimonial(id);
    return NextResponse.json({ message: "Testimonial deleted" });
  } catch (error) {
    console.error("[admin/testimonials/:id] delete failed:", error);
    return NextResponse.json({ error: "Failed to delete testimonial" }, { status: 500 });
  }
}
