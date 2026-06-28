import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SevaBooking, SevaBookingRequest } from "@/types/seva";

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

export const sevaService = {
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
};
