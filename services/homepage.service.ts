import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { HomepageConfig } from "@/types/homepage";

class HomepageService {
  async getHomepage(): Promise<HomepageConfig | null> {
    const ref = doc(db, "homepage", "config");

    const snap = await getDoc(ref);

    if (!snap.exists()) return null;

    return snap.data() as HomepageConfig;
  }
}

export const homepageService = new HomepageService();
