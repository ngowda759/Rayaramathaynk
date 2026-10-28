import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { approveTestimonial, deleteTestimonial } from "@/services/chat.server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const body = (await request.json().catch(() => ({}))) as { approved?: boolean };
    if (body.approved) await approveTestimonial(id);
    return NextResponse.json({ message: "Testimonial updated" });
  } catch (error) {
    console.error("[ai/chat/testimonials/:id] update failed:", error);
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
    console.error("[ai/chat/testimonials/:id] delete failed:", error);
    return NextResponse.json({ error: "Failed to delete testimonial" }, { status: 500 });
  }
}
