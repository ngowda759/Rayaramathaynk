/**
 * Firebase Admin SDK Initialization
 * 
 * This module initializes the Firebase Admin SDK for server-side operations.
 * Use this for Node.js scripts, server actions, and API routes that need
 * elevated permissions to Firestore.
 */

import * as fs from "fs";
import * as path from "path";
import { cert, getApps, initializeApp, getApps as getAppList, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

type AdminModule = typeof import("firebase-admin");

// Use dynamic import for firebase-admin to avoid ESM/CJS interop issues
let adminModule: AdminModule | null = null;
let adminApp: App | null = null;
let adminDb: Firestore | null = null;

async function loadAdminModule(): Promise<AdminModule> {
  if (!adminModule) {
    const mod = await import("firebase-admin");
    adminModule = mod.default || mod;
  }
  return adminModule;
}

/**
 * Initialize Firebase Admin SDK
 * Reads credentials from firebase-admin.json in the project root
 */
export async function initializeAdminApp(): Promise<App> {
  if (adminApp) {
    return adminApp;
  }

  try {
    // Check if already initialized
    const existingApps = getAppList();
    if (existingApps.length > 0) {
      adminApp = existingApps[0]!;
      return adminApp;
    }

    // Read the service account file directly
    const serviceAccountPath = path.join(process.cwd(), "firebase-admin.json");
    
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(`Service account file not found: ${serviceAccountPath}`);
    }
    
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

    console.log("Firebase Admin SDK initialized successfully");
    return adminApp;
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    throw new Error("Firebase Admin SDK initialization failed. Make sure firebase-admin.json exists.");
  }
}

/**
 * Get the Admin Firestore instance
 */
export async function getAdminFirestore(): Promise<Firestore> {
  if (!adminDb) {
    await initializeAdminApp();
    adminDb = getFirestore();
  }
  return adminDb;
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
