import {
  SevaBooking,
  SevaBookingRequest,
  SevaBookingStatus,
  PaymentStatus,
} from "@/types/seva-booking";

import { sevaBookingsRepository } from "@/repositories";

class SevaBookingService {
  async createBooking(
    data: SevaBookingRequest
  ): Promise<string> {
    const result = await sevaBookingsRepository.create(data);
    return result.id;
  }

  async getAllBookings(): Promise<
    SevaBooking[]
  > {
    return sevaBookingsRepository.getAll();
  }

  async getBookingsByUser(
    userId: string
  ): Promise<SevaBooking[]> {
    return sevaBookingsRepository.getByUser(userId);
  }

  async getBookingById(
    bookingId: string
  ): Promise<SevaBooking | null> {
    return sevaBookingsRepository.getById(bookingId);
  }

  async updateBookingStatus(
    bookingId: string,
    status: SevaBookingStatus
  ): Promise<void> {
    await sevaBookingsRepository.updateStatus(bookingId, status);
  }

  async updatePayment(
    bookingId: string,
    paymentData: {
      paymentReference: string;
      paymentStatus: PaymentStatus;
      paymentMethod: string;
    }
  ): Promise<void> {
    await sevaBookingsRepository.updatePayment(bookingId, paymentData);
  }

  async deleteBooking(
    bookingId: string
  ): Promise<void> {
    await sevaBookingsRepository.delete(bookingId);
  }
}

export const sevaBookingService =
  new SevaBookingService();
