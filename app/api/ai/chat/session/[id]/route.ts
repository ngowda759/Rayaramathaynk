import { NextRequest, NextResponse } from "next/server";

import { getChatSession, updateChatSession } from "@/services/chat.server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getChatSession(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json(session);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await updateChatSession(id, await request.json());
    return NextResponse.json({ message: "Session updated" });
  } catch (error) {
    console.error("[ai/chat/session/:id] update failed:", error);
    return NextResponse.json({ error: "Failed to update chat session" }, { status: 500 });
  }
}
