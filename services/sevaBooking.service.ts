import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SevaBooking, SevaBookingRequest, SevaBookingStatus } from "@/types/seva-booking";

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
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || "",
    updatedAt: data.updatedAt?.toDate
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt || "",
  };
}

export const sevaBookingService = {
  async createBooking(
    data: SevaBookingRequest
  ): Promise<string> {
    const docRef = await addDoc(
      collection(db, COLLECTION_NAME),
      {
        ...data,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );

    return docRef.id;
  },

  async getBookingsByUser(
    userId: string
  ): Promise<SevaBooking[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToBooking);
  },

  async getAllBookings(): Promise<SevaBooking[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToBooking);
  },

  async updateBookingStatus(
    bookingId: string,
    status: SevaBookingStatus
  ): Promise<void> {
    const bookingRef = doc(db, COLLECTION_NAME, bookingId);
    await updateDoc(bookingRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  },
};
