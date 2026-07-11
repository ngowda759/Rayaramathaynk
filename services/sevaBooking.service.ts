import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SevaBooking, SevaBookingRequest, SevaBookingStatus, PaymentStatus } from "@/types/seva-booking";

const COLLECTION_NAME = "sevaBookings";

function docToBooking(docSnap: any): SevaBooking {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    sevaId: data.sevaId || "",
    sevaTitle: data.sevaTitle || "",
    sevaAmount: data.sevaAmount ?? 0,
    userId: data.userId || "",
    userName: data.userName || "",
    userEmail: data.userEmail || "",
    userPhone: data.userPhone || "",
    preferredDate: data.preferredDate || "",
    notes: data.notes || "",
    status: data.status || "pending",
    paymentReference: data.paymentReference || "",
    paymentStatus: data.paymentStatus || "pending",
    paymentDate: data.paymentDate || "",
    paymentMethod: data.paymentMethod || "",
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || "",
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || "",
  };
}

class SevaBookingService {
  async createBooking(data: SevaBookingRequest): Promise<string> {
    if (!db) throw new Error("Firebase not configured");
    const docRef = await addDoc(collection(db, COLLECTION_NAME), { ...data, status: "pending", paymentReference: "", paymentStatus: "pending", paymentDate: "", paymentMethod: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return docRef.id;
  }

  async getAllBookings(): Promise<SevaBooking[]> {
    if (!db) return [];
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docToBooking);
    } catch (error) {
      console.error("[BookingService] Error:", error);
      return [];
    }
  }

  async getBookingsByUser(userId: string): Promise<SevaBooking[]> {
    if (!db) return [];
    try {
      const q = query(collection(db, COLLECTION_NAME), where("userId", "==", userId), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docToBooking);
    } catch (error) {
      console.error("[BookingService] Error:", error);
      return [];
    }
  }

  async getBookingById(bookingId: string): Promise<SevaBooking | null> {
    if (!db) return null;
    try {
      const snapshot = await getDoc(doc(db, COLLECTION_NAME, bookingId));
      if (!snapshot.exists()) return null;
      return docToBooking(snapshot);
    } catch (error) {
      console.error("[BookingService] Error:", error);
      return null;
    }
  }

  async updateBookingStatus(bookingId: string, status: SevaBookingStatus): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    await updateDoc(doc(db, COLLECTION_NAME, bookingId), { status, updatedAt: serverTimestamp() });
  }

  async updatePayment(bookingId: string, paymentData: { paymentReference: string; paymentStatus: PaymentStatus; paymentMethod: string; }): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    await updateDoc(doc(db, COLLECTION_NAME, bookingId), { paymentReference: paymentData.paymentReference, paymentStatus: paymentData.paymentStatus, paymentMethod: paymentData.paymentMethod, paymentDate: paymentData.paymentStatus === "completed" ? new Date().toISOString() : "", status: paymentData.paymentStatus === "completed" ? "confirmed" : "pending", updatedAt: serverTimestamp() });
  }

  async deleteBooking(bookingId: string): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    await deleteDoc(doc(db, COLLECTION_NAME, bookingId));
  }
}

export const sevaBookingService = new SevaBookingService();
