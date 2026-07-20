/**
 * Firebase Admin SDK Initialization
 * 
 * This module initializes the Firebase Admin SDK for server-side operations.
 * Use this for Node.js scripts, server actions, and API routes that need
 * elevated permissions to Firestore.
 */

import * as fs from "fs";
import * as path from "path";
import { cert, getApps, initializeApp, getApps as getAppList, App, applicationDefault } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

type AdminModule = typeof import("firebase-admin");

// Use dynamic import for firebase-admin to avoid ESM/CJS interop issues
let adminModule: AdminModule | null = null;
let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let initError: string | null = null;

async function loadAdminModule(): Promise<AdminModule> {
  if (!adminModule) {
    const mod = await import("firebase-admin");
    adminModule = mod.default || mod;
  }
  return adminModule;
}

/**
 * Initialize Firebase Admin SDK
 * Tries multiple methods:
 * 1. Environment variables (FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) - for Vercel deployment
 * 2. Service account JSON file (firebase-admin.json)
 * 3. Application Default Credentials (ADC) - for GCP, Cloud Run, etc.
 */
export async function initializeAdminApp(): Promise<App> {
  if (adminApp) {
    return adminApp;
  }

  if (initError) {
    throw new Error(initError);
  }

  try {
    // Check if already initialized
    const existingApps = getAppList();
    if (existingApps.length > 0) {
      adminApp = existingApps[0]!;
      return adminApp;
    }

    // Try environment variables first (FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY)
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    if (clientEmail && privateKey) {
      // Replace escaped newlines in private key
      const formattedKey = privateKey.replace(/\\n/g, '\n');

      const serviceAccount = {
        type: "service_account",
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        privateKey: formattedKey,
        clientEmail: clientEmail,
      };

      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("Firebase Admin SDK initialized with environment variable credentials");
      return adminApp;
    }

    // Try service account file
    const serviceAccountPath = path.join(process.cwd(), "firebase-admin.json");
    
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

    // Try Application Default Credentials last (works on GCP, local gcloud, etc.)
    try {
      adminApp = initializeApp({
        credential: applicationDefault(),
      });
      console.log("Firebase Admin SDK initialized with Application Default Credentials");
      return adminApp;
    } catch (adcError) {
      console.log("ADC not available:", adcError);
    }

    throw new Error("No Firebase Admin credentials found. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or firebase-admin.json");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    initError = message;
    console.error("Failed to initialize Firebase Admin SDK:", error);
    throw error;
  }
}

/**
 * Get the Admin Firestore instance using @google-cloud/firestore
 * This bypasses security rules for server-side operations
 */
export async function getAdminFirestore(): Promise<Firestore> {
  if (!adminDb) {
    await initializeAdminApp();
    adminDb = getFirestore();
  }
  return adminDb;
}

/**
 * Check if Admin SDK is available
 */
export function isAdminAvailable(): boolean {
  return adminDb !== null && initError === null;
}

/**
 * Get initialization error if any
 */
export function getInitError(): string | null {
  return initError;
}

/**
 * Convenience function to get admin app
 */
export async function getAdminApp(): Promise<App> {
  if (!adminApp) {
    await initializeAdminApp();
  }
  return adminApp!;
}

/**
 * Get the admin module directly
 */
export async function getAdmin(): Promise<AdminModule> {
  if (!adminModule) {
    await loadAdminModule();
  }
  return adminModule!;
}

export { adminApp, adminDb };
