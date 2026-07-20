/**
 * Firebase Admin SDK Initialization
 * 
 * This module initializes the Firebase Admin SDK for server-side operations.
 * Use this for Node.js scripts, server actions, and API routes that need
 * elevated permissions to Firestore.
 */

import * as fs from "fs";
import * as path from "path";

// Use dynamic import for firebase-admin to avoid ESM/CJS interop issues
let admin: any = null;
let adminApp: any = null;
let adminDb: any = null;
let initError: string | null = null;

async function loadAdminModule() {
  if (!admin) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const adminModule = require("firebase-admin");
    admin = adminModule;
  }
  return admin;
}

/**
 * Initialize Firebase Admin SDK
 * Tries multiple methods:
 * 1. Environment variables (FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) - for Vercel deployment
 * 2. Service account JSON file (firebase-admin.json)
 * 3. Application Default Credentials (ADC) - for GCP, Cloud Run, etc.
 */
export async function initializeAdminApp(): Promise<any> {
  if (adminApp) {
    return adminApp;
  }

  if (initError) {
    throw new Error(initError);
  }

  try {
    await loadAdminModule();
    
    // Check if already initialized
    const getApps = admin.getApps || (() => []);
    const existingApps = getApps();
    if (existingApps.length > 0) {
      adminApp = existingApps[0];
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
        project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        private_key: formattedKey,
        client_email: clientEmail,
      };
      
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      console.log("Firebase Admin SDK initialized with environment variable credentials");
      return adminApp;
    }

    // Try service account file
    const serviceAccountPath = path.join(process.cwd(), "firebase-admin.json");
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
      
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      console.log("Firebase Admin SDK initialized with service account file");
      return adminApp;
    }

    // Try Application Default Credentials last (works on GCP, local gcloud, etc.)
    try {
      if (admin.credential && admin.credential.applicationDefault) {
        adminApp = admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
        console.log("Firebase Admin SDK initialized with Application Default Credentials");
        return adminApp;
      }
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
export async function getAdminFirestore(): Promise<any> {
  if (!adminDb) {
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    
    if (clientEmail && privateKey) {
      // Replace escaped newlines in private key
      const formattedKey = privateKey.replace(/\\n/g, '\n');
      
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Firestore } = require("@google-cloud/firestore");
      adminDb = new Firestore({
        projectId: projectId,
        credentials: {
          client_email: clientEmail,
          private_key: formattedKey,
        },
        ignoreUndefinedProperties: true, // Ignore undefined values
      });
      console.log("Admin Firestore initialized with environment credentials");
      return adminDb;
    }

    // Try service account file
    const serviceAccountPath = path.join(process.cwd(), "firebase-admin.json");
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
      
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Firestore } = require("@google-cloud/firestore");
      adminDb = new Firestore({
        projectId: serviceAccount.project_id,
        credentials: serviceAccount,
        ignoreUndefinedProperties: true, // Ignore undefined values
      });
      console.log("Admin Firestore initialized with service account file");
      return adminDb;
    }

    throw new Error("No Firebase Admin credentials found for Firestore");
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
export async function getAdminApp(): Promise<any> {
  if (!adminApp) {
    await initializeAdminApp();
  }
  return adminApp;
}

/**
 * Get the admin module directly
 */
export async function getAdmin(): Promise<any> {
  if (!admin) {
    await loadAdminModule();
  }
  return admin;
}

export { adminApp, adminDb };
