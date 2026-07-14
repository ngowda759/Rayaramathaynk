// Script to seed testimonials into Firestore
// Run with: npx tsx scripts/seed-testimonials.ts
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

// Load Firebase service account from environment or file
function getFirebaseConfig() {
  // Check for service account JSON in environment
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    try {
      return JSON.parse(serviceAccountJson);
    } catch {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON");
      process.exit(1);
    }
  }

  // Check for service account file
  const serviceAccountPath = path.join(process.cwd(), "service-account.json");
  if (fs.existsSync(serviceAccountPath)) {
    return JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  }

  console.error("Firebase service account not found. Please set FIREBASE_SERVICE_ACCOUNT environment variable or create service-account.json");
  process.exit(1);
}

// Default testimonials to seed
const defaultTestimonials = [
  {
    name: "Ramesh Rao",
    location: "Bangalore",
    quote: "The peace I feel at this Matha is indescribable. Every visit brings new spiritual strength and clarity.",
    years: "25 years devotee",
    image: "/testimonials/devotee-1.jpg",
    approved: true,
    createdAt: new Date(),
  },
  {
    name: "Lakshmi Devi",
    location: "Mysore",
    quote: "Sri Raghavendra Swamy's blessings have guided my family through the most challenging times. Forever grateful.",
    years: "Family tradition",
    image: "/testimonials/devotee-2.jpg",
    approved: true,
    createdAt: new Date(),
  },
  {
    name: "Venkataramana",
    location: "Chennai",
    quote: "The daily poojas and the serene atmosphere create a divine experience. This is where my soul finds rest.",
    years: "15 years devotee",
    image: "/testimonials/devotee-3.jpg",
    approved: true,
    createdAt: new Date(),
  },
  {
    name: "Shobha Krishnan",
    location: "Hyderabad",
    quote: "Attending the Bramhotsavam was life-changing. The devotion and rituals are performed with such purity and dedication.",
    years: "Regular visitor",
    image: "/testimonials/devotee-4.jpg",
    approved: true,
    createdAt: new Date(),
  },
];

async function seedTestimonials() {
  try {
    console.log("🚀 Starting testimonials seed...\n");

    // Initialize Firebase Admin
    const serviceAccount = getFirebaseConfig();
    
    initializeApp({
      credential: cert(serviceAccount),
    });

    const db = getFirestore();
    const testimonialsCollection = db.collection("testimonials");

    // Check if collection already has data
    const existingDocs = await testimonialsCollection.limit(1).get();
    
    if (!existingDocs.empty) {
      console.log(`⚠️  Collection 'testimonials' already has ${existingDocs.size} document(s)`);
      console.log("   Skipping seed to avoid duplicates.\n");
      console.log("   To re-seed, first delete all documents in the 'testimonials' collection.");
      process.exit(0);
    }

    // Add default testimonials
    console.log(`📝 Seeding ${defaultTestimonials.length} testimonials...\n`);
    
    for (const testimonial of defaultTestimonials) {
      const docRef = await testimonialsCollection.add(testimonial);
      console.log(`   ✅ Added: "${testimonial.name}" (${docRef.id})`);
    }

    console.log("\n✨ Successfully seeded testimonials collection!");
    console.log("\n📌 Image files should be placed in the GitHub repository at:");
    console.log("   public/testimonials/devotee-1.jpg");
    console.log("   public/testimonials/devotee-2.jpg");
    console.log("   public/testimonials/devotee-3.jpg");
    console.log("   public/testimonials/devotee-4.jpg");
    console.log("\n   Then commit and push to GitHub.\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error seeding testimonials:", error);
    process.exit(1);
  }
}

seedTestimonials();
