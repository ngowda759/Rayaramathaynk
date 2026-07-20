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
      if (!db) throw new Error("Firebase not configured");
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
      if (!db) throw new Error("Firebase not configured");
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
      morningClose: "01:00 PM",

      eveningOpen: "01:00 PM",
      eveningClose: "08:30 PM",

      featuredFestival: "",
      festivalDate: "",

      donationTitle: "Support Rayara Math",
      donationSubtitle:
        "Your generous contribution helps preserve our traditions.",

      templeName: "Rayara Math",
      templeLocation: "",
      templeAddress: "",
      contactEmail: "",
      contactPhone: "",

      isTempleOpen: true,

      heroPrimaryButton: "Book Seva",
      heroSecondaryButton: "Donate",

      footerCopyright: "",

      // Hero Quick Info Cards
      todaySeva: "Daily Pooja Morning",
      todaySevaTime: "09:30 AM",
      featuredFestivalDescription: "Coming Soon",

      // Temple Timings Schedule
      morningSchedule: [
        "Suprabhata Seva",
        "Alankara",
        "Darshan",
        "Theertha & Prasada",
      ],
      eveningSchedule: [
        "Evening Pooja",
        "Mangalarati",
        "Darshan",
        "Temple Closing",
      ],

      // Festival Schedule
      festivalScheduleNote:
        "Temple timings may be extended during festivals, Raghavendra Swamygala Aaradhane, Navaratri and other special occasions. Please check announcements before visiting.",

      // Panchanga
      panchanga: {
        tithi: "",
        nakshatra: "",
        yoga: "",
        karana: "",
        rahuKalam: "",
        gulikaKalam: "",
        masa: "",
      },

      // Hero Stats Section
      heroStats: {
        stat1Label: "Daily",
        stat1Value: "Pooja",
        stat1Description: "",
        stat2Label: "365",
        stat2Value: "Days of Seva",
        stat2Description: "",
        stat3Label: "Guru",
        stat3Value: "Blessings",
        stat3Description: "",
      },
    };
  }
}

export const homepageService = new HomepageService();
