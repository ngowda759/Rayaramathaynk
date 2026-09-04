#!/usr/bin/env npx ts-node
/**
 * Seed the initial Receipt Book seva catalogue into Firestore.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/seed-receipt-sevas.ts
 *   npm run seed:receipt-sevas
 *
 * The script is idempotent: it only adds sevas whose name does not already
 * exist in the receiptSevas collection (so it can be re-run safely).
 */

import { getAdminFirestore } from "@/lib/admin-firebase";
import { ReceiptSevaInput } from "@/types/receiptSeva";

const COLLECTION = "receiptSevas";

const INITIAL_SEVAS: ReceiptSevaInput[] = [
  {
    name: "Panchamrutha Seva",
    description: "Traditional Panchamrutha Abhisheka performed with devotion and Vedic rituals.",
    amount: 105,
    active: true,
    displayOrder:  1,
  },
  {
    name: "Paaduka Pooja, Tottillu, Pallakki Seva",
    description: "Paaduka Pooja, Tottillu and Pallakki seva performed for divine blessings.",
    amount: 505,
    active: true,
    displayOrder:  2,
  },
  {
    name: "Rajatha Rathotsava / Gajavahana Seva",
    description: "Silver chariot (Rajatha Rathotsava) or elephant-vahana seva of Sri Raghavendra Swamy.",
    amount: 1505,
    active: true,
    displayOrder:  3,
  },
  {
    name: "Pushpalankara Seva",
    description: "Floral decoration (Pushpalankara) seva offered to the Lord.",
    amount: 1005,
    active: true,
    displayOrder:  4,
  },
  {
    name: "Kanakabhisheka Seva",
    description: "Kanakabhisheka,a golden abhisheka ritual performed for divine blessings.",
    amount: 1005,
    active: true,
    displayOrder:  5,
  },
  {
    name: "Alankara Brahmanara Seva",
    description: "Alankara (ornamentation) Brahmanara seva performed for prosperity.",
    amount: 2505,
    active: true,
    displayOrder:  6,
  },
  {
    name: "Annadana Seva",
    description: "Sponsor Annadana and receive the blessings of serving devotees at the temple.",
    amount: 5005,
    active: true,
    displayOrder:  7,
  },
  {
    name: "Sampoorna Seva (1 Day)",
    description: "Comprehensive one-day seva package covering all major rituals.",
    amount: 25005,
    active: true,
    displayOrder:  8,
  },
  {
    name: "Annadana Seva (1 Day)",
    description: "Sponsor one day of Annadana (community meal) for temple devotees.",
    amount: 50005,
    active: true,
    displayOrder:  9,
  },
  {
    name: "Sampoorna Seva (3 Day)",
    description: "Comprehensive three-day seva package covering all major rituals.",
    amount: 100005,
    active: true,
    displayOrder:  10,
  },
];

async function seedReceiptSevas() {
  const db = await getAdminFirestore();
  const collection = db.collection(COLLECTION);

  let added = 0;
  let skipped =  0;

  for (const seva of INITIAL_SEVAS) {
    const existing = await collection
      .where("name", "==", seva.name)
      .limit(1)
      .get();

    if (!existing.empty) {
      skipped += 1;
      console.log(`Skipped (already exists): ${seva.name}`);
      continue;
    }

    await collection.add({
      ...seva,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    added += 1;
    console.log(`Added: ${seva.name} - INR ${seva.amount}`);
  }

  console.log(`\nDone: ${added} added, ${skipped} skipped.`);
  process.exit(0);
}

seedReceiptSevas().catch((error) => {
  console.error("Error seeding receipt sevas:", error);
  process.exit(1);
});