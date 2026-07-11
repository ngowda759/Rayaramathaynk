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
  DonationCampaign,
  DonationCampaignRequest,
} from "@/types/donationCampaign";

const COLLECTION_NAME = "donation_campaigns";

function toDate(value: any): string {
  if (!value) return "";

  if (value?.toDate) {
    return value.toDate().toISOString();
  }

  return value;
}

function docToCampaign(docSnap: any): DonationCampaign {
  const data = docSnap.data();

  return {
    id: docSnap.id,

    title: data.title ?? "",

    description: data.description ?? "",

    imageUrl: data.imageUrl ?? "",

    suggestedAmount: Number(
      data.suggestedAmount ?? 0
    ),

    active: data.active ?? true,

    displayOrder: Number(
      data.displayOrder ?? 0
    ),

    createdAt: toDate(data.createdAt),

    updatedAt: toDate(data.updatedAt),
  };
}

class DonationCampaignService {
  async getCampaigns(): Promise<
    DonationCampaign[]
  > {
    if (!db) throw new Error("Firebase not configured");
    const snapshot = await getDocs(
      query(
        collection(db, COLLECTION_NAME),
        orderBy("displayOrder", "asc")
      )
    );

    return snapshot.docs.map(docToCampaign);
  }

  async getActiveCampaigns(): Promise<
    DonationCampaign[]
  > {
    const campaigns =
      await this.getCampaigns();

    return campaigns.filter(
      (campaign) => campaign.active
    );
  }

  async getCampaignById(
    id: string
  ): Promise<DonationCampaign | null> {
    if (!db) throw new Error("Firebase not configured");
    const snapshot = await getDoc(
      doc(db, COLLECTION_NAME, id)
    );

    if (!snapshot.exists()) {
      return null;
    }

    return docToCampaign(snapshot);
  }

  async createCampaign(
    data: DonationCampaignRequest
  ) {
    if (!db) throw new Error("Firebase not configured");
    const docRef = await addDoc(
      collection(db, COLLECTION_NAME),
      {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );

    return docRef.id;
  }

  async updateCampaign(
    id: string,
    data: Partial<DonationCampaignRequest>
  ) {
    if (!db) throw new Error("Firebase not configured");
    await updateDoc(
      doc(db, COLLECTION_NAME, id),
      {
        ...data,
        updatedAt: serverTimestamp(),
      }
    );
  }

  async deleteCampaign(id: string) {
    if (!db) throw new Error("Firebase not configured");
    await deleteDoc(
      doc(db, COLLECTION_NAME, id)
    );
  }
}

export const donationCampaignService =
  new DonationCampaignService();
