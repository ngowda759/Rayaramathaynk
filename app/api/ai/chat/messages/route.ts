import { NextRequest, NextResponse } from "next/server";

import { getChatSession, getSessionMessages, saveMessage } from "@/services/chat.server";
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import type { AIMessage } from "@/types/ai";

/**
 * Read or append to a session's messages.
 *
 * A session bound to a signed-in person (`chat_sessions.user_id`) may only be read
 * or written by that person; the caller is resolved from the verified Supabase
 * access token, never from the request. Anonymous sessions carry no owner and are
 * protected by their unguessable client-generated id (a capability token). A
 * mismatch answers 404 so a caller cannot probe which session ids exist.
 */
async function authorizeSession(request: NextRequest, sessionId: string) {
  const session = await getChatSession(sessionId);
  if (!session) {
    return { ok: false as const, response: NextResponse.json({ error: "Session not found" }, { status: 404 }) };
  }
  if (session.userId) {
    const caller = await verifyBearerIdToken(request);
    if (!caller || caller.uid !== session.userId) {
      return { ok: false as const, response: NextResponse.json({ error: "Session not found" }, { status: 404 }) };
    }
  }
  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session");
  if (!sessionId) return NextResponse.json({ error: "session is required" }, { status: 400 });
  try {
    const allowed = await authorizeSession(request, sessionId);
    if (!allowed.ok) return allowed.response;
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
    const allowed = await authorizeSession(request, body.sessionId);
    if (!allowed.ok) return allowed.response;
    const id = await saveMessage(body.sessionId, body.message);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[ai/chat/messages] save failed:", error);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }
}
