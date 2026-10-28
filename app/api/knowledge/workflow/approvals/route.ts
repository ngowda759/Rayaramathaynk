// API Route: /api/knowledge/workflow/approvals
// Committee approval operations

import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { submitCommitteeVote } from "@/services/knowledge-workflow.service";

/**
 * Cast a committee vote. Admin-only. The voting member is the verified caller, so a
 * request cannot vote on another member's behalf.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { approvalId, decision, comment } = body;

    if (!approvalId || !decision) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!["approve", "reject", "abstain"].includes(decision)) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }

    await submitCommitteeVote(approvalId, auth.user.uid, auth.user.email, decision, comment);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error submitting vote:", error);
    return NextResponse.json({ error: "Failed to submit vote" }, { status: 500 });
  }
}
