// API Route: /api/public/stats
// Returns public statistics for the website

import { NextResponse } from "next/server";
import { getCountFromServer, collection, query, where, getDocs } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";

export async function GET() {
  if (!isFirebaseConfigured() || !db) {
    return NextResponse.json({
      stats: {
        totalUsers: 0,
        activeVolunteers: 0,
        totalMembers: 0,
        totalDonations: 0,
        totalSevaBookings: 0,
        totalEvents: 0,
        upcomingEvents: 0,
        totalDonors: 0,
      }
    });
  }

  try {
    const [
      users,
      volunteers,
      members,
      donations,
      bookings,
      events,
    ] = await Promise.all([
      getCountFromServer(collection(db, "users")),
      getCountFromServer(collection(db, "volunteers")),
      getCountFromServer(collection(db, "members")),
      getCountFromServer(collection(db, "donations")),
      getCountFromServer(collection(db, "sevaBookings")),
      getCountFromServer(collection(db, "events")),
    ]);

    // Count upcoming events
    const now = new Date();
    const upcomingEventsQuery = query(
      collection(db, "events"),
      where("date", ">=", now.toISOString())
    );
    const upcomingEventsSnapshot = await getCountFromServer(upcomingEventsQuery);

    // Count unique donors (by email or phone)
    const donorsQuery = query(
      collection(db, "donations"),
      where("status", "==", "completed")
    );
    const donorsSnapshot = await getDocs(donorsQuery);
    const uniqueDonors = new Set();
    donorsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.email) uniqueDonors.add(data.email);
      if (data.phone) uniqueDonors.add(data.phone);
    });

    return NextResponse.json({
      stats: {
        totalUsers: users.data().count,
        activeVolunteers: volunteers.data().count,
        totalMembers: members.data().count,
        totalDonations: donations.data().count,
        totalSevaBookings: bookings.data().count,
        totalEvents: events.data().count,
        upcomingEvents: upcomingEventsSnapshot.data().count,
        totalDonors: uniqueDonors.size,
      }
    });
  } catch (error) {
    console.error("Error fetching public stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
