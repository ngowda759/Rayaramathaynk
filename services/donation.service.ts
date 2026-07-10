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

function toDate(value: any): string {
  if (!value) return "";

  if (value?.toDate) {
    return value.toDate().toISOString();
  }

  return value;
}

function docToDonation(docSnap: any): DonationRecord {
  const data = docSnap.data();

  return {
    id: docSnap.id,

    donorName: data.donorName ?? data.name ?? "",

    email: data.email ?? "",

    phone: data.phone ?? "",

    address: data.address ?? "",

    amount: Number(data.amount ?? 0),

    purpose: data.purpose ?? "",

    campaignId: data.campaignId ?? "",

    message: data.message ?? "",

    paymentMode:
      data.paymentMode ??
      (data.paymentMethod?.toLowerCase() || "cash"),

    status: data.status ?? "pending",

    receiptNumber: data.receiptNumber ?? "",

    adminRemarks: data.adminRemarks ?? "",

    collectedBy: data.collectedBy ?? "",

    collectedAt: toDate(data.collectedAt),

    createdAt: toDate(data.createdAt),

    updatedAt: toDate(data.updatedAt),
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
        receiptNumber: "",
        adminRemarks: "",
        collectedBy: "",
        collectedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );

    return docRef.id;
  }

  async getDonations(): Promise<DonationRecord[]> {
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

        ...(status === "received"
          ? {
              collectedAt: serverTimestamp(),
            }
          : {}),
      }
    );
  }

  async updateDonation(
    donationId: string,
    data: Partial<DonationRecord>
  ): Promise<void> {
    await updateDoc(
      doc(db, COLLECTION_NAME, donationId),
      {
        ...data,
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
