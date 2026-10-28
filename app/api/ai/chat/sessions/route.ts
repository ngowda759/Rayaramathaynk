import { NextRequest, NextResponse } from "next/server";

import { getUserChatSessions } from "@/services/chat.server";

/** The caller's recent chat sessions, keyed by their Firebase UID. */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user");
  if (!userId) return NextResponse.json({ error: "user is required" }, { status: 400 });
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 20) || 20;
  try {
    return NextResponse.json(await getUserChatSessions(userId, limit));
  } catch (error) {
    console.error("[ai/chat/sessions] read failed:", error);
    return NextResponse.json({ error: "Failed to read chat sessions" }, { status: 500 });
  }
}
