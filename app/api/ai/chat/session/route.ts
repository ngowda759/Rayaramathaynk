import { NextRequest, NextResponse } from "next/server";

import { createChatSession } from "@/services/chat.server";

/** Create a Raya AI chat session for the (possibly anonymous) caller. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { userId?: string | null };
    const id = await createChatSession(body.userId ?? null);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[ai/chat/session] create failed:", error);
    return NextResponse.json({ error: "Failed to create chat session" }, { status: 500 });
  }
}
