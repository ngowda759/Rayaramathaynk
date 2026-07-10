/**
 * Setup Admin User Script
 * 
 * Run this script after setting up Firestore to create an admin user.
 * 
 * Prerequisites:
 *   1. Create a user in Firebase Authentication (Email/Password)
 *   2. Update ADMIN_EMAIL, ADMIN_UID, and ADMIN_NAME below
 *   3. Add Firebase Admin credentials to .env.local
 * 
 * Usage:
 *   npx ts-node scripts/setup-admin.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================
const CONFIG = {
  adminEmail: 'YOUR_ADMIN_EMAIL@gmail.com',      // Your admin email
  adminUid: 'YOUR_UID_FROM_FIREBASE',             // Get from Firebase Console > Authentication > Users
  adminName: 'Admin',                             // Your admin name
};
// ============================================

async function setupAdmin() {
  console.log('🚀 Setting up admin user...\n');

  // Validate configuration
  if (CONFIG.adminUid === 'your-firebase-auth-uid') {
    console.error('❌ Please update CONFIG.adminUid in scripts/setup-admin.ts');
    console.log('\nTo get your UID:');
    console.log('1. Go to Firebase Console > Authentication > Users');
    console.log('2. Click on your user');
    console.log('3. Copy the User UID');
    process.exit(1);
  }

  try {
    // Create admin user document in Firestore
    await db.collection('users').doc(CONFIG.adminUid).set({
      uid: CONFIG.adminUid,
      email: CONFIG.adminEmail,
      name: CONFIG.adminName,
      phone: '',
      role: 'super_admin',
      templeId: 'main',
      profileImage: '',
      isApproved: true,
      isActive: true,
      emailVerified: true,
      lastLogin: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log('✅ Admin user created successfully!');
    console.log('\n📋 User Details:');
    console.log(`   Email: ${CONFIG.adminEmail}`);
    console.log(`   UID: ${CONFIG.adminUid}`);
    console.log(`   Name: ${CONFIG.adminName}`);
    console.log(`   Role: super_admin`);
    console.log('\n✨ You can now login to the admin dashboard!');
    
  } catch (error) {
    console.error('❌ Error setting up admin:', error);
    process.exit(1);
  }
}

setupAdmin();
