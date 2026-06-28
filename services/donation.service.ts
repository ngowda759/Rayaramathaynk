import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DonationRecord, DonationRequest } from "@/types/donation";

const COLLECTION_NAME = "donations";

function docToDonation(docSnap: any): DonationRecord {
  const data = docSnap.data();

  return {
    id: docSnap.id,
    name: data.name || "",
    email: data.email || "",
    phone: data.phone || "",
    amount: data.amount ?? 0,
    message: data.message || "",
    paymentMethod: data.paymentMethod || "Online",
    status: data.status || "pending",
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || "",
    updatedAt: data.updatedAt?.toDate
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt || "",
  };
}

class DonationService {
  async createDonation(data: DonationRequest): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async getDonations(): Promise<DonationRecord[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToDonation);
  }

  async updateDonationStatus(
    donationId: string,
    status: DonationRecord["status"]
  ): Promise<void> {
    const donationRef = doc(db, COLLECTION_NAME, donationId);
    await updateDoc(donationRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  }
}

export const donationService = new DonationService();
