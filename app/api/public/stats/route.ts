// API Route: /api/public/stats
// Returns public aggregate statistics for the website.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EMPTY_STATS = {
  totalUsers: 0,
  activeVolunteers: 0,
  totalMembers: 0,
  totalDonations: 0,
  totalSevaBookings: 0,
  totalEvents: 0,
  upcomingEvents: 0,
  totalDonors: 0,
};

/**
 * Public aggregate counts, read from Supabase with the service role.
 *
 * The counted tables are deny-all under RLS, so the counts are produced server-side;
 * only aggregate numbers leave the server, never individual records. There is no
 * Firestore path.
 */
export async function GET() {
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
      upcomingResult,
      donorsResult,
    ] = await Promise.all([
      count("users"),
      count("volunteers"),
      count("members"),
      count("donations"),
      count("seva_bookings"),
      count("events"),
      supabase.from("events").select("*", { count: "exact", head: true }).gte("start_date", todayIso),
      supabase.from("donations").select("email, phone").eq("status", "received"),
    ]);

    if (upcomingResult.error) throw new Error(upcomingResult.error.message);
    if (donorsResult.error) throw new Error(donorsResult.error.message);

    const uniqueDonors = new Set<string>();
    (donorsResult.data ?? []).forEach((row: any) => {
      if (row.email) uniqueDonors.add(row.email);
      if (row.phone) uniqueDonors.add(row.phone);
    });

    return NextResponse.json({
      stats: {
        totalUsers,
        activeVolunteers,
        totalMembers,
        totalDonations,
        totalSevaBookings,
        totalEvents,
        upcomingEvents: upcomingResult.count ?? 0,
        totalDonors: uniqueDonors.size,
      },
    });
  } catch (error) {
    console.error("Error fetching public stats:", error);
    return NextResponse.json({ stats: EMPTY_STATS });
  }
}
