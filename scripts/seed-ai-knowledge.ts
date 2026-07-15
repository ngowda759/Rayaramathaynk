#!/usr/bin/env npx ts-node

/**
 * Seed AI Knowledge Script
 * 
 * This script imports default knowledge files into the Firebase database.
 * Run with: npm run seed:ai
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';

const SEED_DIR = path.join(process.cwd(), 'seed', 'ai');

// Knowledge categories required for complete coverage
const REQUIRED_CATEGORIES = [
  'temple-timings',
  'visitor-guidelines',
  'dress-code',
  'facilities',
  'parking',
  'volunteer',
  'faq',
  'contact',
  'donation',
  'photography',
  'accommodation',
  'history',
  'raghavendra-swamy',
  'brindavana'
];

interface SeedArticle {
  title: string;
  category: string;
  content: string;
  published?: boolean;
  [key: string]: unknown;
}

async function getFirebaseApp(): Promise<FirebaseApp> {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error('Firebase configuration missing. Please set environment variables.');
  }

  const apps = getApps();
  return apps.length > 0 ? getApp() : initializeApp(firebaseConfig);
}

async function getExistingArticles(db: Firestore): Promise<Map<string, boolean>> {
  const existing = new Map<string, boolean>();
  
  try {
    const articlesRef = collection(db, 'articles');
    const q = query(articlesRef, where('published', '==', true));
    const snapshot = await getDocs(q);
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.category) {
        existing.set(data.category, true);
      }
    });
  } catch (error) {
    console.warn('Could not fetch existing articles:', error);
  }
  
  return existing;
}

async function seedKnowledge(overwrite: boolean = false): Promise<void> {
  console.log('🚀 Starting AI Knowledge Seed...\n');
  
  // Check if seed directory exists
  if (!fs.existsSync(SEED_DIR)) {
    console.error(`❌ Seed directory not found: ${SEED_DIR}`);
    process.exit(1);
  }
  
  // Get Firebase app
  let app: FirebaseApp;
  try {
    app = await getFirebaseApp();
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    console.log('\n💡 Make sure you have Firebase credentials set in .env.local');
    console.log('   Or run this script with Vercel environment variables.\n');
    process.exit(1);
  }
  
  const db = getFirestore(app);
  
  // Get existing published articles
  const existingArticles = overwrite ? new Map() : await getExistingArticles(db);
  
  // Get all seed files
  const seedFiles = fs.readdirSync(SEED_DIR).filter(f => f.endsWith('.json'));
  
  if (seedFiles.length === 0) {
    console.log('⚠️  No seed files found in', SEED_DIR);
    process.exit(0);
  }
  
  console.log(`📁 Found ${seedFiles.length} seed files\n`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const file of seedFiles) {
    const filePath = path.join(SEED_DIR, file);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const article: SeedArticle = JSON.parse(content);
      
      if (!article.category) {
        console.log(`⚠️  Skipping ${file}: missing 'category' field`);
        skipped++;
        continue;
      }
      
      // Skip if article exists and we're not overwriting
      if (existingArticles.has(article.category)) {
        console.log(`⏭️  Skipping ${article.title} (${article.category}) - already exists`);
        skipped++;
        continue;
      }
      
      // Create article document
      const articleId = article.category.replace(/-/g, '_');
      const articleRef = doc(db, 'articles', articleId);
      
      await setDoc(articleRef, {
        ...article,
        id: articleId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system-seed',
        version: 1,
        tags: [article.category, ...(Array.isArray(article.tags) ? article.tags as string[] : [])]
      }, { merge: true });
      
      console.log(`✅ Imported: ${article.title} (${article.category})`);
      imported++;
      
    } catch (error) {
      console.error(`❌ Error importing ${file}:`, error);
      errors++;
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Seed Summary:`);
  console.log(`   ✅ Imported: ${imported}`);
  console.log(`   ⏭️  Skipped:  ${skipped}`);
  console.log(`   ❌ Errors:   ${errors}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (imported > 0) {
    console.log('✨ AI Knowledge seeded successfully!\n');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const overwrite = args.includes('--overwrite') || args.includes('-o');

seedKnowledge(overwrite).catch(console.error);
