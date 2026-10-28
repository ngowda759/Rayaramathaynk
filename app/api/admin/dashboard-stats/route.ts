import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin dashboard counts, read from Supabase with the service role.
 *
 * `users`, `volunteers`, `members`, `donations`, `seva_bookings`, `events` and
 * `chat_sessions` are deny-all under RLS, so these counts cannot be produced from the
 * browser. The caller must be an authenticated admin. There is no Firestore path.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const supabase = createAdminClient();

    async function count(table: string): Promise<number> {
      const { count: value, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) throw new Error(`Could not count ${table}: ${error.message}`);
      return value ?? 0;
    }

    const todayIso = new Date().toISOString().split("T")[0];

    const [
      totalUsers,
      activeVolunteers,
      totalMembers,
      totalDonations,
      totalSevaBookings,
      totalEvents,
      totalAIConversations,
      upcomingResult,
      donationsResult,
    ] = await Promise.all([
      count("users"),
      count("volunteers"),
      count("members"),
      count("donations"),
      count("seva_bookings"),
      count("events"),
      count("chat_sessions"),
      supabase.from("events").select("*", { count: "exact", head: true }).gte("start_date", todayIso),
      supabase.from("donations").select("email, phone, amount").eq("status", "received"),
    ]);

    if (upcomingResult.error) throw new Error(upcomingResult.error.message);
    if (donationsResult.error) throw new Error(donationsResult.error.message);

    const donors = new Set<string>();
    let donationAmount = 0;
    (donationsResult.data ?? []).forEach((row: any) => {
      if (row.email) donors.add(row.email);
      if (row.phone) donors.add(row.phone);
      donationAmount += Number(row.amount ?? 0);
    });

    return NextResponse.json({
      totalUsers,
      activeVolunteers,
      totalMembers,
      totalDonations,
      totalSevaBookings,
      totalEvents,
      upcomingEvents: upcomingResult.count ?? 0,
      totalDonors: donors.size,
      totalAIConversations,
      donationAmount,
    });
  } catch (error) {
    console.error("[admin/dashboard-stats] Failed to compute stats:", error);
    return NextResponse.json({ error: "Failed to compute dashboard stats" }, { status: 500 });
  }
}
