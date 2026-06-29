export type SevaBookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled";

export interface SevaBooking {
  id: string;
  sevaId: string;
  sevaTitle: string;
  sevaAmount: number;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  preferredDate: string;
  notes: string;
  status: SevaBookingStatus;
  createdAt: string;
  updatedAt: string;
}

export type SevaBookingRequest = Omit<
  SevaBooking,
  "id" | "status" | "createdAt" | "updatedAt"
>;
