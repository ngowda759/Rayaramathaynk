import { NextRequest, NextResponse } from "next/server";

import { getSessionMessages, saveMessage } from "@/services/chat.server";
import type { AIMessage } from "@/types/ai";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session");
  if (!sessionId) return NextResponse.json({ error: "session is required" }, { status: 400 });
  try {
    return NextResponse.json(await getSessionMessages(sessionId));
  } catch (error) {
    console.error("[ai/chat/messages] read failed:", error);
    return NextResponse.json({ error: "Failed to read messages" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionId: string; message: AIMessage };
    if (!body?.sessionId || !body?.message) {
      return NextResponse.json({ error: "sessionId and message are required" }, { status: 400 });
    }
    const id = await saveMessage(body.sessionId, body.message);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[ai/chat/messages] save failed:", error);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }
}
