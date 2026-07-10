export type SevaBookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled";

export type PaymentStatus = "pending" | "completed" | "failed";

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
  // Payment fields
  paymentReference: string;
  paymentStatus: PaymentStatus;
  paymentDate: string;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
}

export type SevaBookingRequest = Omit<
  SevaBooking,
  "id" | "status" | "paymentReference" | "paymentStatus" | "paymentDate" | "paymentMethod" | "createdAt" | "updatedAt"
>;
