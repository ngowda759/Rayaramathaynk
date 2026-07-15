// API Route: /api/knowledge/workflow/approvals
// Committee approval operations

import { NextRequest, NextResponse } from "next/server";
import { submitCommitteeVote, getArticleCommitteeApproval } from "@/services/knowledge-workflow.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { approvalId, memberId, memberName, decision, comment } = body;

    if (!approvalId || !memberId || !memberName || !decision) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["approve", "reject", "abstain"].includes(decision)) {
      return NextResponse.json(
        { error: "Invalid decision" },
        { status: 400 }
      );
    }

    await submitCommitteeVote(approvalId, memberId, memberName, decision, comment);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error submitting vote:", error);
    return NextResponse.json(
      { error: "Failed to submit vote" },
      { status: 500 }
    );
  }
}
