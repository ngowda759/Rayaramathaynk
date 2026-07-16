#!/usr/bin/env npx ts-node
/**
 * Seed Guru Parampara Aaradhane Configuration to Firestore
 * 
 * This script initializes the lunar calendar data in Firestore.
 * Run this once to set up the Guru Parampara configuration.
 * 
 * After running this, the yearly generation script will read from Firestore
 * and automatically generate events based on the lunar calendar data.
 * 
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/seed-guru-parampara.ts
 *   npm run seed:guru-parampara
 * 
 * Options:
 *   --force    Overwrite existing data
 */

import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GuruParamparaRecord } from "@/types/aaradhane-generator";

const COLLECTION = "guruParampara";
const DOCUMENT = "aaradhanaes";

/**
 * Master data for all Guru Aaradhanes with lunar calendar information
 */
const GURU_AARADHANE_DATA: GuruParamparaRecord[] = [
  // 01. Sri Madhvacharya (Founder)
  {
    id: "madhvacharya",
    guruName: "Sri Madhvacharya",
    aaradhaneTitle: "Sri Madhvacharya Aaradhane",
    paramparaNumber: 1,
    lunarMonth: "Chaitra",
    paksha: "Shukla",
    tithiNumber: 10,
    tithi: "Dashami",
    durationDays: 3,
    importance: "major",
    enabled: true,
    description: "Founder of Dvaita philosophy and the Madhwa tradition"
  },

  // 02. Sri Padmanabha Tirtha
  {
    id: "padmanabha-teertha",
    guruName: "Sri Padmanabha Teertharu",
    aaradhaneTitle: "Sri Padmanabha Teertha Aaradhane",
    paramparaNumber: 2,
    lunarMonth: "Vaishakha",
    paksha: "Shukla",
    tithiNumber: 8,
    tithi: "Ashtami",
    durationDays: 1,
    importance: "minor",
    enabled: true
  },

  // 03. Sri Narahari Teertha
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

  // 04. Sri Madhava Tirtha
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

  // 05. Sri Akshobhya Tirtha
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

  // 06. Sri Jayateertha
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

  // 07. Sri Vidyadhiraja Tirtha
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

  // 08. Sri Kavindra Tirtha
  {
    id: "kavendra-teertha",
    guruName: "Sri Kavendra Teertharu",
    aaradhaneTitle: "Sri Kavendra Teertha Aaradhane",
    paramparaNumber: 8,
    lunarMonth: "Kārtika",
    paksha: "Krishna",
    tithiNumber: 11,
    tithi: "Ekadashi",
    durationDays: 1,
    importance: "minor",
    enabled: true
  },

  // 09. Sri Vageesha Tirtha
  {
    id: "vageesha-teertha",
    guruName: "Sri Vageesha Teertharu",
    aaradhaneTitle: "Sri Vageesha Teertha Aaradhane",
    paramparaNumber: 9,
    lunarMonth: "Mārghaśīrṣa",
    paksha: "Shukla",
    tithiNumber: 3,
    tithi: "Tṛtiya",
    durationDays: 1,
    importance: "minor",
    enabled: true
  },

  // 10. Sri Ramachandra Tirtha
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

  // 11. Sri Vibudhendra Tirtha
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

  // 12. Sri Jitamitra Tirtha
  {
    id: "jitamitra-teertha",
    guruName: "Sri Jitamitra Teertharu",
    aaradhaneTitle: "Sri Jitamitra Teertha Aaradhane",
    paramparaNumber: 12,
    lunarMonth: "Chaitra",
    paksha: "Krishna",
    tithiNumber: 10,
    tithi: "Dashami",
    durationDays: 1,
    importance: "minor",
    enabled: true
  },

  // 13. Sri Raghunandana Tirtha
  {
    id: "raghunandana-teertha",
    guruName: "Sri Raghunandana Teertharu",
    aaradhaneTitle: "Sri Raghunandana Teertha Aaradhane",
    paramparaNumber: 13,
    lunarMonth: "Vaishakha",
    paksha: "Shukla",
    tithiNumber: 11,
    tithi: "Ekadashi",
    durationDays: 2,
    importance: "minor",
    enabled: true
  },

  // 14. Sri Surendra Tirtha
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

  // 15. Sri Vijayeendra Tirtha
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

  // 16. Sri Sudheeendra Tirtha
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

  // 17. Sri Raghavendra Teertha - POORVA AARADHANE
  {
    id: "raghavendra-poorva",
    guruName: "Sri Raghavendra Swamy",
    aaradhaneTitle: "Sri Raghavendra Swamy Poorva Aaradhane",
    paramparaNumber: 17,
    lunarMonth: "Vaishakha",
    paksha: "Krishna",
    tithiNumber: 13,
    tithi: "Trayodashi",
    durationDays: 3,
    raghavendraPhase: "Poorva",
    importance: "major",
    enabled: true,
    description: "First phase - commemorates his teachings and philosophy"
  },

  // 17. Sri Raghavendra Teertha - MADHYA AARADHANE
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

  // 17. Sri Raghavendra Teertha - UTTARA AARADHANE
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

/**
 * Seed Guru Parampara data to Firestore
 * @param askConfirmation If true, will not overwrite existing data without confirmation
 * @returns true if seeding was successful
 */
export async function seedGuruParampara(askConfirmation = true): Promise<boolean> {
  console.log("\n" + "=".repeat(60));
  console.log("GURU PARAMPARA AARADHANE SEEDER");
  console.log("=".repeat(60));

  if (!db) {
    console.error("\nFirebase not configured. Please set up Firebase environment variables.");
    console.error("\nRequired environment variables:");
    console.error("  NEXT_PUBLIC_FIREBASE_API_KEY");
    console.error("  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
    console.error("  NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    console.error("  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
    console.error("  NEXT_PUBLIC_FIREBASE_APP_ID");
    return false;
  }

  // Check if data already exists
  const docRef = doc(db, COLLECTION, DOCUMENT);
  
  if (askConfirmation) {
    const existingDoc = await getDoc(docRef);
    
    if (existingDoc.exists()) {
      console.log("\nGuru Parampara Aaradhane data already exists in Firestore.");
      console.log("\nExisting data will be preserved.");
      console.log("\nTo re-seed, first delete the document:");
      console.log(`  Collection: ${COLLECTION}`);
      console.log(`  Document: ${DOCUMENT}`);
      console.log("\nOr use --force to overwrite:");
      console.log("  npx ts-node scripts/seed-guru-parampara.ts --force");
      
      // Check for --force flag
      if (process.argv.includes("--force")) {
        console.log("\nForce mode: Overwriting existing data...");
      } else {
        return false;
      }
    }
  }

  console.log("\nSeeding Guru Parampara Aaradhane configuration...");
  console.log(`   Collection: ${COLLECTION}`);
  console.log(`   Document: ${DOCUMENT}`);
  console.log(`   Records: ${GURU_AARADHANE_DATA.length}`);

  try {
    await setDoc(docRef, {
      gurus: GURU_AARADHANE_DATA,
      updatedAt: new Date().toISOString(),
    });

    console.log("\nSuccessfully seeded Guru Parampara Aaradhane data!");
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
    
    return true;

  } catch (error) {
    console.error("\nError seeding data:", error);
    return false;
  }
}

// Run as standalone script
if (require.main === module) {
  seedGuruParampara().catch(console.error);
}
