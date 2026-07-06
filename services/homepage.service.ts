import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { HomepageConfig } from "@/types/homepage";

const COLLECTION = "homepage";
const DOCUMENT = "config";

class HomepageService {
  async getHomepage(): Promise<HomepageConfig> {
    const ref = doc(db, COLLECTION, DOCUMENT);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return this.getDefaultConfig();
    }

    return {
      ...this.getDefaultConfig(),
      ...(snap.data() as HomepageConfig),
    };
  }

  async saveHomepage(data: HomepageConfig): Promise<void> {
    const ref = doc(db, COLLECTION, DOCUMENT);

    await setDoc(
      ref,
      {
        ...data,
        updatedAt: serverTimestamp(),
      },
      {
        merge: true,
      }
    );
  }

  getDefaultConfig(): HomepageConfig {
    return {
      heroTitle: "Welcome to Rayara Math",
      heroSubtitle: "Experience devotion and tradition",
      heroImage: "",

      announcement: "",

      morningOpen: "06:00 AM",
      morningClose: "12:00 PM",

      eveningOpen: "05:00 PM",
      eveningClose: "08:30 PM",

      featuredFestival: "",
      festivalDate: "",

      donationTitle: "Support Rayara Math",
      donationSubtitle:
        "Your generous contribution helps preserve our traditions.",

      templeName: "Rayara Math",
      templeLocation: "",

      isTempleOpen: true,

      heroPrimaryButton: "Book Seva",
      heroPrimaryButtonLink: "/sevas",

      heroSecondaryButton: "Donate",
      heroSecondaryButtonLink: "/donation",

      footerCopyright: "",

      panchanga: {
        tithi: "",
        nakshatra: "",
        yoga: "",
        karana: "",
      },
    };
  }
}

export const homepageService = new HomepageService();
