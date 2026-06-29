import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import {
  SevaBooking,
  SevaBookingRequest,
  SevaBookingStatus,
} from "@/types/seva-booking";

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

class SevaBookingService {
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
  }

  async getAllBookings(): Promise<
    SevaBooking[]
  > {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(docToBooking);
  }

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
  }

  async getBookingById(
    bookingId: string
  ): Promise<SevaBooking | null> {
    const snapshot = await getDoc(
      doc(db, COLLECTION_NAME, bookingId)
    );

    if (!snapshot.exists()) {
      return null;
    }

    return docToBooking(snapshot);
  }

  async updateBookingStatus(
    bookingId: string,
    status: SevaBookingStatus
  ): Promise<void> {
    await updateDoc(
      doc(db, COLLECTION_NAME, bookingId),
      {
        status,
        updatedAt: serverTimestamp(),
      }
    );
  }

  async deleteBooking(
    bookingId: string
  ): Promise<void> {
    await deleteDoc(
      doc(db, COLLECTION_NAME, bookingId)
    );
  }
}

export const sevaBookingService =
  new SevaBookingService();
