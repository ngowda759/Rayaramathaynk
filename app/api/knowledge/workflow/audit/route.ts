// API Route: /api/knowledge/workflow/audit
// Audit log operations

import { NextRequest, NextResponse } from "next/server";
import { getAuditLog } from "@/services/knowledge-workflow.service";
import { AuditLogEntry } from "@/types/knowledge-workflow";
import { requireAdminUser } from "@/lib/auth/admin-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get("entityType") as AuditLogEntry["entityType"];
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId are required" },
        { status: 400 }
      );
    }

    const entries = await getAuditLog(entityType, entityId);

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error fetching audit log:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit log" },
      { status: 500 }
    );
  }
}
