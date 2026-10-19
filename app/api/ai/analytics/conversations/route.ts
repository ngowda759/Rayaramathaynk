// API Route: /api/ai/analytics/conversations
// Returns chat session counts for the AI dashboard.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireAdminUser(request);
  if (!guard.ok) return guard.response;

  try {
    const supabase = createAdminClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: total, error: totalError } = await supabase
      .from("chat_sessions")
      .select("id", { count: "exact", head: true });
    if (totalError) throw totalError;

    const { count: today, error: todayError } = await supabase
      .from("chat_sessions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());
    if (todayError) throw todayError;

    return NextResponse.json(
      { totalConversations: total || 0, todayConversations: today || 0 },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error fetching conversation counts:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation counts" },
      { status: 500 }
    );
  }
}
