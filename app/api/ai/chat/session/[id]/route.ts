import { NextRequest, NextResponse } from "next/server";

import { getChatSession, updateChatSession } from "@/services/chat.server";
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import type { ChatSession } from "@/types/ai";

/**
 * Read or update a single chat session.
 *
 * A session bound to a signed-in person (`chat_sessions.user_id`) may only be read
 * or changed by that person; the caller is resolved from the verified Supabase
 * access token. An ownerless (anonymous) session is protected by its unguessable
 * id. A mismatch answers 404 so a caller cannot probe which ids exist. The update
 * accepts only the presentation fields - never `userId` - so a caller cannot
 * reassign a session to someone else.
 */
async function ownedSession(request: NextRequest, id: string) {
  const session = await getChatSession(id);
  if (!session) return { ok: false as const, response: NextResponse.json({ error: "Session not found" }, { status: 404 }) };
  if (session.userId) {
    const caller = await verifyBearerIdToken(request);
    if (!caller || caller.uid !== session.userId) {
      return { ok: false as const, response: NextResponse.json({ error: "Session not found" }, { status: 404 }) };
    }
  }
  return { ok: true as const, session };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const owned = await ownedSession(request, id);
  if (!owned.ok) return owned.response;
  return NextResponse.json(owned.session);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const owned = await ownedSession(request, id);
    if (!owned.ok) return owned.response;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const updates: Partial<ChatSession> = {};
    if (typeof body.messageCount === "number") updates.messageCount = body.messageCount;
    if (typeof body.lastMessage === "string") updates.lastMessage = body.lastMessage;
    if (typeof body.detectedLanguage === "string") {
      updates.detectedLanguage = body.detectedLanguage as ChatSession["detectedLanguage"];
    }

    await updateChatSession(id, updates);
    return NextResponse.json({ message: "Session updated" });
  } catch (error) {
    console.error("[ai/chat/session/:id] update failed:", error);
    return NextResponse.json({ error: "Failed to update chat session" }, { status: 500 });
  }
}
