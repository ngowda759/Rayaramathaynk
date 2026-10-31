import "server-only";
import { rowIdFilter } from "@/lib/supabase/identifier";

import { createAdminClient } from "@/lib/supabase/admin";
import { SevaBooking, SevaBookingRequest, SevaBookingStatus, PaymentStatus } from "@/types/seva-booking";

const TABLE = "seva_bookings";

/**
 * A booking request the caller got wrong (unknown/inactive/offline seva). The route
 * maps this to a 400, so it is deliberately distinct from a storage failure, which
 * stays a 500.
 */
export class SevaBookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SevaBookingError";
  }
}

/** The price-relevant columns of a bookable seva, resolved server-side. */
interface BookableSeva {
  id: string;
  name: string;
  amount: number;
}

/**
 * Reads the seva the booking names, with the service role, and rejects anything the
 * public booking flow must not accept: an unknown id, an inactive seva, or one the
 * temple does not offer online. The returned amount is the temple's, so the client
 * cannot choose what it pays.
 *
 * Custom-amount ("any amount" / Karnike) sevas are counter-only by a database
 * constraint, so they are rejected here by the online-visibility check.
 */
async function resolveBookableSeva(sevaId: string): Promise<BookableSeva> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sevas")
    .select("firestore_id, id, name, amount, active, visibility")
    .or(rowIdFilter(sevaId))
    .maybeSingle();
  if (error) throw new Error(`Could not read seva: ${error.message}`);
  if (!data) throw new SevaBookingError("This seva does not exist");
  if (data.active === false) throw new SevaBookingError("This seva is not available");
  if (data.visibility && data.visibility !== "online" && data.visibility !== "both") {
    throw new SevaBookingError("This seva is not offered for online booking");
  }
  return {
    id: data.firestore_id || data.id,
    name: data.name,
    amount: Number(data.amount ?? 0),
  };
}

/**
 * Seva bookings, stored in Supabase `seva_bookings`.
 *
 * Reads use the service-role admin client: bookings carry devotee contact details and
 * the table is deny-all under RLS. There is no Firestore path; a read failure throws.
 */
function rowToBooking(row: any): SevaBooking {
  return {
    id: row.firestore_id || row.id,
    sevaId: row.seva_id || "",
    sevaTitle: row.seva_title || "",
    sevaAmount: Number(row.seva_amount ?? 0),
    userId: row.user_id || "",
    userName: row.user_name || "",
    userEmail: row.user_email || "",
    userPhone: row.user_phone || "",
    gotra: row.gotra || "",
    nakshatra: row.nakshatra || "",
    raashi: row.raashi || "",
    preferredDate: row.preferred_date || "",
    notes: row.notes || "",
    status: row.status || "pending",
    paymentReference: row.payment_reference || "",
    paymentStatus: row.payment_status || "pending",
    paymentDate: row.payment_date || "",
    paymentMethod: row.payment_method || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

class SevaBookingService {
  async createBooking(data: SevaBookingRequest): Promise<string> {
    // The seva's title and price are the temple's, never the caller's: a forged
    // `sevaAmount`/`sevaTitle` in the request cannot change what is stored.
    const seva = await resolveBookableSeva(data.sevaId);

    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from(TABLE)
      .insert({
        seva_id: seva.id,
        seva_title: seva.name,
        seva_amount: seva.amount,
        user_id: data.userId,
        user_name: data.userName,
        user_email: data.userEmail,
        user_phone: data.userPhone,
        gotra: data.gotra ?? "",
        nakshatra: data.nakshatra ?? "",
        raashi: data.raashi ?? "",
        preferred_date: data.preferredDate,
        notes: data.notes,
        status: "pending",
        payment_reference: "",
        payment_status: "pending",
        payment_date: "",
        payment_method: "",
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(`Could not create seva booking: ${error.message}`);
    return row.firestore_id || row.id;
  }

  async getAllBookings(): Promise<SevaBooking[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Could not read seva bookings: ${error.message}`);
    return (data ?? []).map(rowToBooking);
  }

  async getBookingsByUser(userId: string): Promise<SevaBooking[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Could not read seva bookings: ${error.message}`);
    return (data ?? []).map(rowToBooking);
  }

  async getBookingById(bookingId: string): Promise<SevaBooking | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .or(rowIdFilter(bookingId))
      .maybeSingle();
    if (error) throw new Error(`Could not read seva booking: ${error.message}`);
    return data ? rowToBooking(data) : null;
  }

  async updateBookingStatus(bookingId: string, status: SevaBookingStatus): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ status, updated_at: new Date().toISOString() })
      .or(rowIdFilter(bookingId));
    if (error) throw new Error(`Could not update seva booking: ${error.message}`);
  }

  /**
   * The trusted payment path: an administrator recording a payment, or a verified
   * payment-gateway callback. This is the only path that may set `completed` (and so
   * confirm the booking). It is never reachable from the self-service devotee route.
   */
  async updatePayment(
    bookingId: string,
    paymentData: { paymentReference: string; paymentStatus: PaymentStatus; paymentMethod: string }
  ): Promise<void> {
    const supabase = createAdminClient();
    const completed = paymentData.paymentStatus === "completed";
    const { error } = await supabase
      .from(TABLE)
      .update({
        payment_reference: paymentData.paymentReference,
        payment_status: paymentData.paymentStatus,
        payment_method: paymentData.paymentMethod,
        payment_date: completed ? new Date().toISOString() : "",
        status: completed ? "confirmed" : "pending",
        updated_at: new Date().toISOString(),
      })
      .or(rowIdFilter(bookingId));
    if (error) throw new Error(`Could not update seva booking payment: ${error.message}`);
  }

  /**
   * Records a devotee's *claimed* payment reference for their booking.
   *
   * This is not a payment: the reference is stored as `pending`, and the booking stays
   * unconfirmed until an administrator (or a verified gateway callback) confirms it.
   * A devotee cannot mark their own booking paid.
   */
  async recordPaymentClaim(
    bookingId: string,
    claim: { paymentReference: string; paymentMethod: string }
  ): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from(TABLE)
      .update({
        payment_reference: claim.paymentReference,
        payment_method: claim.paymentMethod,
        payment_status: "pending",
        payment_date: "",
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .or(rowIdFilter(bookingId))
      .neq("status", "confirmed")
      .neq("status", "completed");
    if (error) throw new Error(`Could not record seva booking payment claim: ${error.message}`);
  }

  async deleteBooking(bookingId: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).delete().or(rowIdFilter(bookingId));
    if (error) throw new Error(`Could not delete seva booking: ${error.message}`);
  }
}

export const sevaBookingService = new SevaBookingService();
