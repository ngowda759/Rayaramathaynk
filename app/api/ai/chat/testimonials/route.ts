import { NextRequest, NextResponse } from "next/server";

import { requireAdminCapability } from "@/lib/auth/admin-capabilities";
import { getApprovedTestimonials, getPendingTestimonials } from "@/services/chat.server";

/** AI testimonials. Approved ones are public; the pending list is admin-only. */
export async function GET(request: NextRequest) {
  const pending = request.nextUrl.searchParams.get("pending") === "1";
  try {
    if (pending) {
      const auth = await requireAdminCapability(request, "ai.chat_moderation");
      if (!auth.ok) return auth.response;
      return NextResponse.json(await getPendingTestimonials());
    }
    return NextResponse.json(await getApprovedTestimonials());
  } catch (error) {
    console.error("[ai/chat/testimonials] read failed:", error);
    return NextResponse.json({ error: "Failed to read testimonials" }, { status: 500 });
  }
}
