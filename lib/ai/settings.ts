import { db, isFirebaseConfigured } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { SYSTEM_PROMPT, WELCOME_MESSAGE } from "./systemPrompt";

// AI Settings stored in Firebase
export interface AISettings {
  systemPrompt: string;
  welcomeMessage: string;
  enabled: boolean;
  updatedAt: any;
}

// Default AI Settings
export const DEFAULT_AI_SETTINGS: AISettings = {
  systemPrompt: SYSTEM_PROMPT,
  welcomeMessage: WELCOME_MESSAGE,
  enabled: true,
  updatedAt: null,
};

// Cache for AI settings
let cachedSettings: AISettings | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get AI settings from Firebase
export async function getAISettings(): Promise<AISettings> {
  // Check cache first
  if (cachedSettings && Date.now() - lastFetchTime < CACHE_DURATION) {
    return cachedSettings;
  }

  if (!isFirebaseConfigured() || !db) {
    // Return defaults if Firebase not configured
    return DEFAULT_AI_SETTINGS;
  }

  try {
    const docRef = doc(db, "settings", "ai");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      cachedSettings = {
        ...DEFAULT_AI_SETTINGS,
        ...docSnap.data(),
      } as AISettings;
      lastFetchTime = Date.now();
      return cachedSettings;
    } else {
      // Initialize with defaults if not exists
      await saveAISettings(DEFAULT_AI_SETTINGS);
      return DEFAULT_AI_SETTINGS;
    }
  } catch (error) {
    console.error("[AISettings] Error fetching settings:", error);
    return cachedSettings || DEFAULT_AI_SETTINGS;
  }
}

// Save AI settings to Firebase
export async function saveAISettings(settings: Partial<AISettings>): Promise<void> {
  if (!isFirebaseConfigured() || !db) {
    console.log("[AISettings] Firebase not configured, cannot save settings");
    return;
  }

  try {
    const docRef = doc(db, "settings", "ai");
    await setDoc(
      docRef,
      {
        ...settings,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Clear cache so next fetch gets updated values
    cachedSettings = null;
    lastFetchTime = 0;

    console.log("[AISettings] Settings saved successfully");
  } catch (error) {
    console.error("[AISettings] Error saving settings:", error);
    throw error;
  }
}

// Clear settings cache (useful after admin updates)
export function clearSettingsCache(): void {
  cachedSettings = null;
  lastFetchTime = 0;
}

// Get just the system prompt (used by chat API)
export async function getSystemPrompt(): Promise<string> {
  const settings = await getAISettings();
  return settings.systemPrompt;
}

// Get just the welcome message (used by chat frontend)
export async function getWelcomeMessage(): Promise<string> {
  const settings = await getAISettings();
  return settings.welcomeMessage;
}

// Check if AI chat is enabled
export async function isAIChatEnabled(): Promise<boolean> {
  const settings = await getAISettings();
  return settings.enabled;
}
