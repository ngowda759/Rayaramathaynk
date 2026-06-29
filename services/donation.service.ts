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
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import {
  DonationRecord,
  DonationRequest,
  DonationStatus,
} from "@/types/donation";

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
  async createDonation(
    data: DonationRequest
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

  async getDonations(): Promise<
    DonationRecord[]
  > {
    const snapshot = await getDocs(
      query(
        collection(db, COLLECTION_NAME),
        orderBy("createdAt", "desc")
      )
    );

    return snapshot.docs.map(docToDonation);
  }

  async getDonationById(
    donationId: string
  ): Promise<DonationRecord | null> {
    const snapshot = await getDoc(
      doc(db, COLLECTION_NAME, donationId)
    );

    if (!snapshot.exists()) {
      return null;
    }

    return docToDonation(snapshot);
  }

  async updateDonationStatus(
    donationId: string,
    status: DonationStatus
  ): Promise<void> {
    await updateDoc(
      doc(db, COLLECTION_NAME, donationId),
      {
        status,
        updatedAt: serverTimestamp(),
      }
    );
  }

  async deleteDonation(
    donationId: string
  ): Promise<void> {
    await deleteDoc(
      doc(db, COLLECTION_NAME, donationId)
    );
  }
}

export const donationService =
  new DonationService();
