// API Route: /api/ai/analytics/conversations
// Returns chat session counts for the AI dashboard.

import { NextRequest, NextResponse } from "next/server";
import { requireRayaAdminUser } from "@/lib/auth/raya-admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireRayaAdminUser(request);
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

    // Last-7-days breakdown, computed server-side so the admin UI never needs a
    // browser (anon) client against a table protected by deny-all RLS.
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const { data: recentSessions, error: recentError } = await supabase
      .from("chat_sessions")
      .select("created_at")
      .gte("created_at", sevenDaysAgo.toISOString());
    if (recentError) throw recentError;

    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const daily = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      const count = (recentSessions || []).filter((row) => {
        if (!row.created_at) return false;
        const createdAt = new Date(row.created_at as string);
        return createdAt >= dayStart && createdAt <= dayEnd;
      }).length;
      return { label: dayLabels[date.getDay()], value: count };
    });

    return NextResponse.json(
      {
        totalConversations: total || 0,
        todayConversations: today || 0,
        daily,
      },
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
