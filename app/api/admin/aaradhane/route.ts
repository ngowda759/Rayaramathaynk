import { NextRequest, NextResponse } from "next/server";

import { requireAdminCapability } from "@/lib/auth/admin-capabilities";
import { aaradhaneService } from "@/services/aaradhane.server";
import type { Aaradhane } from "@/types/aaradhane";

/** Admin aaradhane list and creation. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminCapability(request, "aaradhane.read");
  if (!auth.ok) return auth.response;
  try {
    const data = await aaradhaneService.getAaradhanes();
    return NextResponse.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("[admin/aaradhane] read failed:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch aaradhanes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminCapability(request, "aaradhane.write");
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as Omit<Aaradhane, "id" | "createdAt" | "createdBy">;
    const id = await aaradhaneService.createAaradhane(body, auth.user.email);
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    console.error("[admin/aaradhane] create failed:", error);
    return NextResponse.json({ success: false, error: "Failed to create aaradhane" }, { status: 500 });
  }
}
