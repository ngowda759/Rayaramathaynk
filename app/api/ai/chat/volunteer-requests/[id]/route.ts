import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { updateVolunteerRequestStatus } from "@/services/chat.server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const body = (await request.json()) as { status: "pending" | "contacted" | "completed" };
    await updateVolunteerRequestStatus(id, body.status);
    return NextResponse.json({ message: "Volunteer request updated" });
  } catch (error) {
    console.error("[ai/chat/volunteer-requests/:id] update failed:", error);
    return NextResponse.json({ error: "Failed to update volunteer request" }, { status: 500 });
  }
}
