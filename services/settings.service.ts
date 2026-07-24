import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  addDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SiteSettings, SiteSettingsPayload } from "@/types/settings";

const COLLECTION = "settings";

function docToSettings(docSnap: any): SiteSettings {
  const data = docSnap.data();

  return {
    id: docSnap.id,
    templeName: data.templeName || "Sri Raghavendra Swamy Temple",
    contactEmail: data.contactEmail || "info@example.com",
    contactPhone: data.contactPhone || "",
    address: data.address || "",
    footerText: data.footerText || "",
    welcomeMessage: data.welcomeMessage || "",
    updatedAt: data.updatedAt,
  };
}

export interface SocialLinksData {
  facebook: string;
  instagram: string;
  youtube: string;
  whatsapp: string;
  twitter: string;
  linkedin: string;
  mapUrl: string;
  showFacebook: boolean;
  showInstagram: boolean;
  showYoutube: boolean;
  showWhatsapp: boolean;
  showTwitter: boolean;
  showLinkedin: boolean;
  showMap: boolean;
}

const SOCIAL_LINKS_DOC = "socialLinks";

const defaultSocialLinks: SocialLinksData = {
  facebook: "",
  instagram: "",
  youtube: "https://www.youtube.com/@Guru_Raghavendra_Rayaru",
  whatsapp: "",
  twitter: "",
  linkedin: "",
  mapUrl: "",
  showFacebook: true,
  showInstagram: true,
  showYoutube: true,
  showWhatsapp: true,
  showTwitter: false,
  showLinkedin: false,
  showMap: true,
};

class SettingsService {
  async getSettings(): Promise<SiteSettings | null> {
    if (!db) throw new Error("Firebase not configured");
    const q = query(collection(db, COLLECTION), orderBy("updatedAt", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    return docToSettings(snapshot.docs[0]);
  }

  async createSettings(data: SiteSettingsPayload): Promise<string> {
    if (!db) throw new Error("Firebase not configured");
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateSettings(id: string, data: Partial<SiteSettingsPayload>) {
    if (!db) throw new Error("Firebase not configured");
    const settingsRef = doc(db, COLLECTION, id);
    return updateDoc(settingsRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  async getSocialLinks(): Promise<SocialLinksData> {
    if (!db) return defaultSocialLinks;
    try {
      const docRef = doc(db, COLLECTION, SOCIAL_LINKS_DOC);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { ...defaultSocialLinks, ...docSnap.data() } as SocialLinksData;
      }
      return defaultSocialLinks;
    } catch (error) {
      console.error("Error fetching social links:", error);
      return defaultSocialLinks;
    }
  }
}

export const settingsService = new SettingsService();
