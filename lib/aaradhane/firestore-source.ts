/**
 * Firestore operations for reading Guru Parampara data
 * 
 * This module reads lunar calendar configuration from Firestore
 * to generate Aaradhane events.
 */

import {
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  GuruParamparaRecord,
  LunarMonth,
  Paksha,
  Tithi,
  AaradhanePhase,
  GuruImportance,
} from "@/types/aaradhane-generator";

const COLLECTION_NAME = "guruParampara";

/**
 * Get all Guru Parampara records from Firestore
 * Each record contains lunar calendar data for generating Aaradhane events
 */
export async function getGuruParamparaRecords(): Promise<GuruParamparaRecord[]> {
  if (!db) {
    throw new Error("Firebase not configured");
  }
  
  const docRef = doc(db, COLLECTION_NAME, "aaradhanaes");
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    console.warn("No guru parampara Aaradhane configuration found in Firestore");
    return [];
  }
  
  const data = docSnap.data();
  const gurus: GuruParamparaRecord[] = data.gurus || [];
  
  // Filter to only enabled gurus and ensure valid data
  return gurus
    .filter(g => g.enabled !== false)
    .map(g => ({
      id: g.id || `guru-${g.paramparaNumber}`,
      guruName: g.guruName || "",
      aaradhaneTitle: g.aaradhaneTitle || `${g.guruName} Aaradhane`,
      paramparaNumber: g.paramparaNumber || 0,
      lunarMonth: g.lunarMonth as LunarMonth,
      paksha: g.paksha as Paksha,
      tithiNumber: g.tithiNumber || 1,
      tithi: g.tithi as Tithi,
      durationDays: g.durationDays || 1,
      raghavendraPhase: g.raghavendraPhase as AaradhanePhase | undefined,
      importance: (g.importance || "minor") as GuruImportance,
      enabled: g.enabled !== false,
      description: g.description,
    }));
}

/**
 * Get a single Guru Parampara record by ID
 */
export async function getGuruParamparaById(id: string): Promise<GuruParamparaRecord | null> {
  if (!db) {
    throw new Error("Firebase not configured");
  }
  
  const docRef = doc(db, COLLECTION_NAME, "aaradhanaes");
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  const data = docSnap.data();
  const gurus: GuruParamparaRecord[] = data.gurus || [];
  
  return gurus.find(g => g.id === id) || null;
}

/**
 * Check if Guru Parampara data exists in Firestore
 */
export async function hasGuruParamparaData(): Promise<boolean> {
  if (!db) {
    return false;
  }
  
  try {
    const docRef = doc(db, COLLECTION_NAME, "aaradhanaes");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() && (docSnap.data().gurus?.length || 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Get count of configured Guru Aaradhanes
 */
export async function getGuruAaradhaneCount(): Promise<number> {
  const records = await getGuruParamparaRecords();
  return records.length;
}
