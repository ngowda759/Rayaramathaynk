import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { SevaBooking, SevaBookingRequest, SevaBookingStatus, PaymentStatus } from "@/types/seva-booking";

const TABLE = "seva_bookings";

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
    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from(TABLE)
      .insert({
        seva_id: data.sevaId,
        seva_title: data.sevaTitle,
        seva_amount: data.sevaAmount,
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
      .eq("firestore_id", bookingId)
      .maybeSingle();
    if (error) throw new Error(`Could not read seva booking: ${error.message}`);
    return data ? rowToBooking(data) : null;
  }

  async updateBookingStatus(bookingId: string, status: SevaBookingStatus): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ status, updated_at: new Date().toISOString() })
      .eq("firestore_id", bookingId);
    if (error) throw new Error(`Could not update seva booking: ${error.message}`);
  }

  async updatePayment(
    bookingId: string,
    paymentData: { paymentReference: string; paymentStatus: PaymentStatus; paymentMethod: string }
  ): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from(TABLE)
      .update({
        payment_reference: paymentData.paymentReference,
        payment_status: paymentData.paymentStatus,
        payment_method: paymentData.paymentMethod,
        payment_date: paymentData.paymentStatus === "completed" ? new Date().toISOString() : "",
        status: paymentData.paymentStatus === "completed" ? "confirmed" : "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("firestore_id", bookingId);
    if (error) throw new Error(`Could not update seva booking payment: ${error.message}`);
  }

  async deleteBooking(bookingId: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).delete().eq("firestore_id", bookingId);
    if (error) throw new Error(`Could not delete seva booking: ${error.message}`);
  }
}

export const sevaBookingService = new SevaBookingService();
