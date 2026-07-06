import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { TempleSettings } from "@/types/temple";
import temple from "@/website-settings/temple.json";

const SETTINGS_COLLECTION = "website-settings";
const TEMPLE_DOCUMENT = "temple";

export async function getTempleSettings(): Promise<TempleSettings> {
  try {
    const ref = doc(
      db,
      SETTINGS_COLLECTION,
      TEMPLE_DOCUMENT
    );

    const snapshot = await getDoc(ref);

    if (snapshot.exists()) {
      return snapshot.data() as TempleSettings;
    }

    // First run: seed Firestore from JSON
    await setDoc(ref, temple);

    return temple as TempleSettings;
  } catch (error) {
    console.error(
      "Failed to load temple settings:",
      error
    );

    return temple as TempleSettings;
  }
}

export async function updateTempleSettings(
  data: Partial<TempleSettings>
) {
  const ref = doc(
    db,
    SETTINGS_COLLECTION,
    TEMPLE_DOCUMENT
  );

  await setDoc(ref, data, {
    merge: true,
  });
}
