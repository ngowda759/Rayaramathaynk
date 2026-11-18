import { NextRequest, NextResponse } from "next/server";

import { getUserChatSessions } from "@/services/chat.server";
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";

/**
 * The caller's recent chat sessions.
 *
 * The owner is taken from the verified Supabase access token, never from the
 * request, so a caller can only list their own sessions. The `user` query
 * parameter is accepted for call-site compatibility but is not trusted: if it is
 * present and does not match the verified caller, the request is refused.
 */
export async function GET(request: NextRequest) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requestedUser = request.nextUrl.searchParams.get("user");
  if (requestedUser && requestedUser !== caller.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 20) || 20;
  try {
    return NextResponse.json(await getUserChatSessions(caller.uid, limit));
  } catch (error) {
    console.error("[ai/chat/sessions] read failed:", error);
    return NextResponse.json({ error: "Failed to read chat sessions" }, { status: 500 });
  }
}
