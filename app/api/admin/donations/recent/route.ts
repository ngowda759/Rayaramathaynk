import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { donationService } from "@/services/donation.server";

/**
 * Recent donations for the admin notification dropdown.
 *
 * `donations` is deny-all under RLS, so the browser cannot read it with the anon key.
 * This route is guarded by `requireAdminUser` and reads through `donationService` with
 * the service-role client. It replaces the browser `getDocs(collection(db, "donations"))`
 * call the notification hook previously made against Firestore.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const donations = await donationService.getDonations();
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = donations
      .filter((d) => {
        const created = d.createdAt ? new Date(d.createdAt as unknown as string).getTime() : 0;
        return created >= cutoff;
      })
      .slice(0, 20);
    return NextResponse.json({ success: true, data: recent });
  } catch (error) {
    console.error("[API] Error reading recent donations:", error);
    return NextResponse.json({ error: "Failed to load recent donations" }, { status: 500 });
  }
}
