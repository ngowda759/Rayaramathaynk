/**
 * Repository for managing seva bookings.
 * This repository provides CRUD operations for bookings using JSON storage.
 */

import { SevaBooking, SevaBookingRequest, SevaBookingStatus, PaymentStatus } from "@/types/seva-booking";
import { readJson, writeJson, generateId } from "@/lib/storage";

const STORAGE_FILE = "sevaBookings.json";

interface BookingsData {
  items: SevaBooking[];
}

export const sevaBookingsRepository = {
  /**
   * Get all bookings, sorted by creation date (newest first)
   */
  async getAll(): Promise<SevaBooking[]> {
    const data = await readJson<BookingsData>(STORAGE_FILE);
    if (!data) return [];

    return [...data.items].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  },

  /**
   * Get bookings by user ID
   */
  async getByUser(userId: string): Promise<SevaBooking[]> {
    const items = await this.getAll();
    return items.filter((item) => item.userId === userId);
  },

  /**
   * Get booking by ID
   */
  async getById(id: string): Promise<SevaBooking | null> {
    const data = await readJson<BookingsData>(STORAGE_FILE);
    if (!data) return null;

    return data.items.find((item) => item.id === id) || null;
  },

  /**
   * Create a new booking
   */
  async create(booking: SevaBookingRequest): Promise<SevaBooking> {
    const data = await readJson<BookingsData>(STORAGE_FILE) || { items: [] };
    const now = new Date().toISOString();

    const newBooking: SevaBooking = {
      ...booking,
      id: generateId(),
      status: "pending",
      paymentReference: "",
      paymentStatus: "pending",
      paymentDate: "",
      paymentMethod: "",
      createdAt: now,
      updatedAt: now,
    };

    data.items.push(newBooking);
    await writeJson(STORAGE_FILE, data);

    return newBooking;
  },

  /**
   * Update booking status
   */
  async updateStatus(
    id: string,
    status: SevaBookingStatus
  ): Promise<SevaBooking | null> {
    const data = await readJson<BookingsData>(STORAGE_FILE);
    if (!data) return null;

    const index = data.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated: SevaBooking = {
      ...data.items[index],
      status,
      updatedAt: new Date().toISOString(),
    };

    data.items[index] = updated;
    await writeJson(STORAGE_FILE, data);

    return updated;
  },

  /**
   * Update payment information
   */
  async updatePayment(
    id: string,
    paymentData: {
      paymentReference: string;
      paymentStatus: PaymentStatus;
      paymentMethod: string;
    }
  ): Promise<SevaBooking | null> {
    const data = await readJson<BookingsData>(STORAGE_FILE);
    if (!data) return null;

    const index = data.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const now = new Date().toISOString();
    const updated: SevaBooking = {
      ...data.items[index],
      paymentReference: paymentData.paymentReference,
      paymentStatus: paymentData.paymentStatus,
      paymentMethod: paymentData.paymentMethod,
      paymentDate: paymentData.paymentStatus === "completed" ? now : "",
      status: paymentData.paymentStatus === "completed" ? "confirmed" : data.items[index].status,
      updatedAt: now,
    };

    data.items[index] = updated;
    await writeJson(STORAGE_FILE, data);

    return updated;
  },

  /**
   * Delete a booking
   */
  async delete(id: string): Promise<boolean> {
    const data = await readJson<BookingsData>(STORAGE_FILE);
    if (!data) return false;

    const initialLength = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);

    if (data.items.length === initialLength) return false;

    await writeJson(STORAGE_FILE, data);
    return true;
  },

  /**
   * Get the count of all bookings
   */
  async count(): Promise<number> {
    const data = await readJson<BookingsData>(STORAGE_FILE);
    return data?.items.length || 0;
  },
};
