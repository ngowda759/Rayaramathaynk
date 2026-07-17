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
 * Reads credentials from firebase-admin.json in the project root
 */
export async function initializeAdminApp(): Promise<any> {
  if (adminApp) {
    return adminApp;
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

    // Read the service account file directly
    const serviceAccountPath = path.join(process.cwd(), "firebase-admin.json");
    
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(`Service account file not found: ${serviceAccountPath}`);
    }
    
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    
    // Use admin.cert if available, otherwise try admin.credential.cert
    const certFn = admin.cert || (admin.credential && admin.credential.cert);
    if (!certFn) {
      throw new Error("Firebase Admin SDK does not have cert function available");
    }
    
    adminApp = admin.initializeApp({
      credential: certFn(serviceAccount),
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
export async function getAdminFirestore(): Promise<any> {
  if (!adminDb) {
    await initializeAdminApp();
    adminDb = admin.firestore();
  }
  return adminDb;
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
