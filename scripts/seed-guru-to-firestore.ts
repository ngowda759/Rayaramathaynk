/**
 * Seed Guru Parampara Aaradhane Configuration to Firestore
 * Uses Firebase Admin SDK
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

// Initialize Firebase Admin
function initFirebase() {
  if (!getApps() || !getApps().length) {
    const serviceAccount = JSON.parse(
      fs.readFileSync("firebase-admin.json", "utf8")
    );
    initializeApp({
      credential: cert(serviceAccount),
    });
  }
  return getFirestore();
}

const COLLECTION = "guruParampara";
const DOCUMENT = "aaradhanaes";

const GURU_AARADHANE_DATA = [
  {
    id: "madhvacharya",
    guruName: "Sri Madhvacharya",
    aaradhaneTitle: "Sri Madhvacharya Aaradhane",
    paramparaNumber: 1,
    lunarMonth: "Caitra",
    paksha: "Shukla",
    tithiNumber: 10,
    tithi: "Dashami",
    durationDays: 3,
    importance: "major",
    enabled: true,
    description: "Founder of Dvaita philosophy and the Madhwa tradition"
  },
  {
    id: "padmanabha-teertha",
    guruName: "Sri Padmanabha Teertharu",
    aaradhaneTitle: "Sri Padmanabha Teertha Aaradhane",
    paramparaNumber: 2,
    lunarMonth: "Vaiśākha",
    paksha: "Shukla",
    tithiNumber: 8,
    tithi: "Ashtami",
    durationDays: 1,
    importance: "minor",
    enabled: true
  },
  {
    id: "narahari-teertha",
    guruName: "Sri Narahari Teertharu",
    aaradhaneTitle: "Sri Narahari Teertha Aaradhane",
    paramparaNumber: 3,
    lunarMonth: "Jyeṣṭha",
    paksha: "Krishna",
    tithiNumber: 10,
    tithi: "Dashami",
    durationDays: 1,
    importance: "minor",
    enabled: true
  },
  {
    id: "madhava-teertha",
    guruName: "Sri Madhava Teertharu",
    aaradhaneTitle: "Sri Madhava Teertha Aaradhane",
    paramparaNumber: 4,
    lunarMonth: "Āṣāḍha",
    paksha: "Shukla",
    tithiNumber: 5,
    tithi: "Panchami",
    durationDays: 1,
    importance: "minor",
    enabled: true
  },
  {
    id: "akshobhya-teertha",
    guruName: "Sri Akshobhya Teertharu",
    aaradhaneTitle: "Sri Akshobhya Teertha Aaradhane",
    paramparaNumber: 5,
    lunarMonth: "Bhādrapada",
    paksha: "Krishna",
    tithiNumber: 7,
    tithi: "Saptami",
    durationDays: 1,
    importance: "minor",
    enabled: true
  },
  {
    id: "jayateertha",
    guruName: "Sri Jayateertharu",
    aaradhaneTitle: "Sri Jayateertha Aaradhane",
    paramparaNumber: 6,
    lunarMonth: "Bhādrapada",
    paksha: "Shukla",
    tithiNumber: 9,
    tithi: "Navami",
    durationDays: 2,
    importance: "major",
    enabled: true,
    description: "Author of popular compositions like 'Muktimale' and 'Tirtha Prabhanda'"
  },
  {
    id: "vidyadhiraaja",
    guruName: "Sri Vidyadhirajaru",
    aaradhaneTitle: "Sri Vidyadhiraja Tirtha Aaradhane",
    paramparaNumber: 7,
    lunarMonth: "Āśvina",
    paksha: "Shukla",
    tithiNumber: 15,
    tithi: "Purnima",
    durationDays: 3,
    importance: "major",
    enabled: true,
    description: "Renowned scholar who defended Dvaita philosophy against Advaita scholars"
  },
  {
    id: "kavendra-teertha",
    guruName: "Sri Kavendra Teertharu",
    aaradhaneTitle: "Sri Kavendra Teertha Aaradhane",
    paramparaNumber: 8,
    lunarMonth: "Kārttika",
    paksha: "Krishna",
    tithiNumber: 11,
    tithi: "Ekadashi",
    durationDays: 1,
    importance: "minor",
    enabled: true
  },
  {
    id: "vageesha-teertha",
    guruName: "Sri Vageesha Teertharu",
    aaradhaneTitle: "Sri Vageesha Teertha Aaradhane",
    paramparaNumber: 9,
    lunarMonth: "Mārgaśīrṣa",
    paksha: "Shukla",
    tithiNumber: 3,
    tithi: "Tṛtiya",
    durationDays: 1,
    importance: "minor",
    enabled: true
  },
  {
    id: "ramachandra-teertha",
    guruName: "Sri Ramachandra Teertharu",
    aaradhaneTitle: "Sri Ramachandra Teertha Aaradhane",
    paramparaNumber: 10,
    lunarMonth: "Māgha",
    paksha: "Shukla",
    tithiNumber: 7,
    tithi: "Saptami",
    durationDays: 2,
    importance: "minor",
    enabled: true
  },
  {
    id: "vibudhendra-teertha",
    guruName: "Sri Vibudhendra Teertharu",
    aaradhaneTitle: "Sri Vibudhendra Teertha Aaradhane",
    paramparaNumber: 11,
    lunarMonth: "Phālguna",
    paksha: "Krishna",
    tithiNumber: 12,
    tithi: "Dvadashi",
    durationDays: 1,
    importance: "minor",
    enabled: true
  },
  {
    id: "jitamitra-teertha",
    guruName: "Sri Jitamitra Teertharu",
    aaradhaneTitle: "Sri Jitamitra Teertha Aaradhane",
    paramparaNumber: 12,
    lunarMonth: "Caitra",
    paksha: "Krishna",
    tithiNumber: 10,
    tithi: "Dashami",
    durationDays: 1,
    importance: "minor",
    enabled: true
  },
  {
    id: "raghunandana-teertha",
    guruName: "Sri Raghunandana Teertharu",
    aaradhaneTitle: "Sri Raghunandana Teertha Aaradhane",
    paramparaNumber: 13,
    lunarMonth: "Vaiśākha",
    paksha: "Shukla",
    tithiNumber: 11,
    tithi: "Ekadashi",
    durationDays: 2,
    importance: "minor",
    enabled: true
  },
  {
    id: "surendra-teertha",
    guruName: "Sri Surendra Teertharu",
    aaradhaneTitle: "Sri Surendra Teertha Aaradhane",
    paramparaNumber: 14,
    lunarMonth: "Jyeṣṭha",
    paksha: "Shukla",
    tithiNumber: 10,
    tithi: "Dashami",
    durationDays: 1,
    importance: "minor",
    enabled: true
  },
  {
    id: "vijayeendra-teertha",
    guruName: "Sri Vijayeendra Teertharu",
    aaradhaneTitle: "Sri Vijayeendra Teertha Aaradhane",
    paramparaNumber: 15,
    lunarMonth: "Śrāvaṇa",
    paksha: "Krishna",
    tithiNumber: 15,
    tithi: "Purnima",
    durationDays: 3,
    importance: "major",
    enabled: true,
    description: "Last pontiff before Sri Raghavendra Swamy - oversaw preparations for the Matha"
  },
  {
    id: "sudheeendra-teertha",
    guruName: "Sri Sudheeendra Teertharu",
    aaradhaneTitle: "Sri Sudheeendra Teertha Aaradhane",
    paramparaNumber: 16,
    lunarMonth: "Bhādrapada",
    paksha: "Shukla",
    tithiNumber: 7,
    tithi: "Saptami",
    durationDays: 2,
    importance: "major",
    enabled: true,
    description: "Immediate predecessor of Sri Raghavendra Swamy, initiated him as pontiff"
  },
  {
    id: "raghavendra-poorva",
    guruName: "Sri Raghavendra Swamy",
    aaradhaneTitle: "Sri Raghavendra Swamy Poorva Aaradhane",
    paramparaNumber: 17,
    lunarMonth: "Vaiśākha",
    paksha: "Krishna",
    tithiNumber: 13,
    tithi: "Trayodashi",
    durationDays: 3,
    raghavendraPhase: "Poorva",
    importance: "major",
    enabled: true,
    description: "First phase - commemorates his teachings and philosophy"
  },
  {
    id: "raghavendra-madhya",
    guruName: "Sri Raghavendra Swamy",
    aaradhaneTitle: "Sri Raghavendra Swamy Madhya Aaradhane",
    paramparaNumber: 17,
    lunarMonth: "Jyeṣṭha",
    paksha: "Shukla",
    tithiNumber: 11,
    tithi: "Ekadashi",
    durationDays: 3,
    raghavendraPhase: "Madhya",
    importance: "major",
    enabled: true,
    description: "Second phase - marks his Samadhi and divine prophecy"
  },
  {
    id: "raghavendra-uttara",
    guruName: "Sri Raghavendra Swamy",
    aaradhaneTitle: "Sri Raghavendra Swamy Uttara Aaradhane",
    paramparaNumber: 17,
    lunarMonth: "Māgha",
    paksha: "Krishna",
    tithiNumber: 11,
    tithi: "Ekadashi",
    durationDays: 3,
    raghavendraPhase: "Uttara",
    importance: "major",
    enabled: true,
    description: "Final phase - celebrates the Brindavana Utsava and continued blessings"
  }
];

async function seedGuruParampara() {
  console.log("\n" + "=".repeat(60));
  console.log("GURU PARAMPARA AARADHANE SEEDER - FIRESTORE");
  console.log("=".repeat(60));

  // Check for firebase-admin.json
  if (!fs.existsSync("firebase-admin.json")) {
    console.error("\nError: firebase-admin.json not found!");
    console.error("Please save the Firebase service account JSON file as firebase-admin.json");
    process.exit(1);
  }

  const db = initFirebase();
  const docRef = db.collection(COLLECTION).doc(DOCUMENT);

  // Check if data already exists
  const existingDoc = await docRef.get();
  
  if (existingDoc.exists) {
    console.log("\nGuru Parampara Aaradhane data already exists in Firestore.");
    console.log("\nExisting data will be preserved.");
    console.log("\nTo re-seed, first delete the document in Firebase Console:");
    console.log(`  Collection: ${COLLECTION}`);
    console.log(`  Document: ${DOCUMENT}`);
    
    // Check for --force flag
    if (!process.argv.includes("--force")) {
      console.log("\nOr run with --force to overwrite:");
      console.log("  npx tsx scripts/seed-guru-to-firestore.ts --force");
      process.exit(0);
    }
    console.log("\nForce mode: Overwriting existing data...");
  }

  console.log("\nSeeding Guru Parampara Aaradhane configuration to Firestore...");
  console.log(`   Collection: ${COLLECTION}`);
  console.log(`   Document: ${DOCUMENT}`);
  console.log(`   Records: ${GURU_AARADHANE_DATA.length}`);

  try {
    await docRef.set({
      gurus: GURU_AARADHANE_DATA,
      updatedAt: new Date().toISOString(),
    });

    console.log("\n✅ Successfully seeded Guru Parampara Aaradhane data to Firestore!");
    console.log("\n" + "-".repeat(60));
    console.log("Summary:");
    console.log("-".repeat(60));
    
    const majorCount = GURU_AARADHANE_DATA.filter(g => g.importance === "major").length;
    const minorCount = GURU_AARADHANE_DATA.filter(g => g.importance === "minor").length;
    const raghavendraCount = GURU_AARADHANE_DATA.filter(g => g.guruName === "Sri Raghavendra Swamy").length;
    
    console.log(`   Total Gurus: ${GURU_AARADHANE_DATA.length}`);
    console.log(`   Major Importance: ${majorCount}`);
    console.log(`   Minor Importance: ${minorCount}`);
    console.log(`   Sri Raghavendra Swamy: ${raghavendraCount} (Poorva, Madhya, Uttara)`);
    
    console.log("\n" + "-".repeat(60));
    console.log("\nNext Steps:");
    console.log("   1. Verify data in Firestore Console");
    console.log("   2. Run 'npm run generate:aaradhane' to generate events");
    console.log("   3. Events will appear in Admin > Events automatically");
    console.log("\n" + "=".repeat(60));
    
    process.exit(0);

  } catch (error) {
    console.error("\n❌ Error seeding data:", error);
    process.exit(1);
  }
}

seedGuruParampara();
