"use server";

import { adminDb } from "@/lib/firebase-admin";
import { TempleSettings } from "@/types/temple";

const COLLECTION = "website-settings";
const DOCUMENT = "temple";

export async function updateTempleSettingsAction(
  data: Partial<TempleSettings>
) {
  await adminDb
    .collection(COLLECTION)
    .doc(DOCUMENT)
    .set(data, {
      merge: true,
    });

  return {
    success: true,
  };
}
