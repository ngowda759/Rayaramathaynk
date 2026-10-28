import { apiFetch } from "@/lib/api/fetch";
import { SevaBooking, SevaBookingRequest, SevaBookingStatus, PaymentStatus } from "@/types/seva-booking";

/**
 * Seva bookings, stored in Supabase `seva_bookings`.
 *
 * Bookings carry devotee contact details and the table is deny-all under RLS, so the
 * browser never reads it directly. A devotee creates a booking through the public
 * `/api/bookings` route; the admin console reads and edits through the admin-guarded
 * routes. The server uses the service role. There is no Firestore path; a failure
 * throws rather than returning an empty list.
 */
class SevaBookingService {
  async createBooking(data: SevaBookingRequest): Promise<string> {
    const { id } = await apiFetch<{ id: string }>("/api/bookings", { method: "POST", body: data });
    return id;
  }

  async getAllBookings(): Promise<SevaBooking[]> {
    return apiFetch<SevaBooking[]>("/api/admin/bookings");
  }

  async getBookingsByUser(userId: string): Promise<SevaBooking[]> {
    return apiFetch<SevaBooking[]>(`/api/bookings?user=${encodeURIComponent(userId)}`);
  }

  async getBookingById(bookingId: string): Promise<SevaBooking | null> {
    try {
      return await apiFetch<SevaBooking>(`/api/bookings/${encodeURIComponent(bookingId)}`);
    } catch {
      return null;
    }
  }

  async updateBookingStatus(bookingId: string, status: SevaBookingStatus): Promise<void> {
    await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
      method: "PATCH",
      body: { status },
    });
  }

  async updatePayment(
    bookingId: string,
    paymentData: { paymentReference: string; paymentStatus: PaymentStatus; paymentMethod: string }
  ): Promise<void> {
    await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
      method: "PATCH",
      body: { payment: paymentData },
    });
  }

  async deleteBooking(bookingId: string): Promise<void> {
    await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, { method: "DELETE" });
  }
}

export const sevaBookingService = new SevaBookingService();
