import { NextRequest, NextResponse } from "next/server";

import { createChatSession } from "@/services/chat.server";
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";

/**
 * Create a Raya AI chat session for the (possibly anonymous) caller.
 *
 * The owner is the verified Supabase caller, never a value from the request body,
 * so a caller cannot open a session owned by someone else. An anonymous caller
 * creates an ownerless session.
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await verifyBearerIdToken(request);
    const id = await createChatSession(caller?.uid ?? null);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[ai/chat/session] create failed:", error);
    return NextResponse.json({ error: "Failed to create chat session" }, { status: 500 });
  }
}
