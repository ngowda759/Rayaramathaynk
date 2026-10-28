import { NextRequest, NextResponse } from "next/server";

import { submitFeedback } from "@/services/chat.server";
import type { ChatFeedback } from "@/types/ai";

/** Record helpful / not-helpful feedback on a Raya AI answer. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Omit<ChatFeedback, "id" | "createdAt">;
    const id = await submitFeedback(body);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[ai/chat/feedback] create failed:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
