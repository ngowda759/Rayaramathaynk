import { createAdminClient } from "../lib/supabase/admin";

interface TargetSeva {
  firestore_id: string;
  name: string;
  description: string;
  category: string;
  amount: number;
  duration: number;
  image_url: string | null;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string | null;
}

const sevasData: Omit<TargetSeva, 'firestore_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: "Panchamrutha Seva",
    description: "Special Panchamrutha Seva during Aradhana Mahotsava",
    category: "Aradhana",
    amount: 105,
    duration: 60,
    image_url: null,
    active: true,
    display_order: 1
  },
  {
    name: "Paaduka Pooja, Tottilu, Pallakki Seva",
    description: "Special Paaduka Pooja, Tottilu, Pallakki Seva during Aradhana Mahotsava",
    category: "Aradhana",
    amount: 505,
    duration: 60,
    image_url: null,
    active: true,
    display_order: 2
  },
  {
    name: "Rajatha Rathotsava / Gajavahana Seva",
    description: "Special Rajatha Rathotsava / Gajavahana Seva during Aradhana Mahotsava",
    category: "Aradhana",
    amount: 1505,
    duration: 60,
    image_url: null,
    active: true,
    display_order: 3
  },
  {
    name: "Pushpalankara Seva",
    description: "Special Pushpalankara Seva during Aradhana Mahotsava",
    category: "Aradhana",
    amount: 1005,
    duration: 60,
    image_url: null,
    active: true,
    display_order: 4
  },
  {
    name: "Kanakabhisheka Seva",
    description: "Special Kanakabhisheka Seva during Aradhana Mahotsava",
    category: "Aradhana",
    amount: 1005,
    duration: 60,
    image_url: null,
    active: true,
    display_order: 5
  },
  {
    name: "Alankara Brahmanara Seva",
    description: "Special Alankara Brahmanara Seva during Aradhana Mahotsava",
    category: "Aradhana",
    amount: 2505,
    duration: 60,
    image_url: null,
    active: true,
    display_order: 6
  },
  {
    name: "Annadana Seva",
    description: "Special Annadana Seva during Aradhana Mahotsava",
    category: "Aradhana",
    amount: 5005,
    duration: 60,
    image_url: null,
    active: true,
    display_order: 7
  },
  {
    name: "Sampoorna Seva (1 Day)",
    description: "Special Sampoorna Seva (1 Day) during Aradhana Mahotsava",
    category: "Aradhana",
    amount: 25005,
    duration: 1440,
    image_url: null,
    active: true,
    display_order: 8
  },
  {
    name: "Annadana Seva (1 Day)",
    description: "Special Annadana Seva (1 Day) during Aradhana Mahotsava",
    category: "Aradhana",
    amount: 50005,
    duration: 1440,
    image_url: null,
    active: true,
    display_order: 9
  },
  {
    name: "Sampoorna Seva (3 Day)",
    description: "Special Sampoorna Seva (3 Day) during Aradhana Mahotsava",
    category: "Aradhana",
    amount: 100005,
    duration: 4320,
    image_url: null,
    active: true,
    display_order: 10
  }
];

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");

  console.log("=== STARTING SEVAS SEEDING ===");
  if (isDryRun) {
    console.log("=== RUNNING IN DRY-RUN MODE (No data will be written) ===");
  }

  try {
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const recordsToUpsert: TargetSeva[] = sevasData.map((seva, index) => ({
      ...seva,
      firestore_id: `seed_aradhana_seva_${index + 1}`,
      created_at: now,
      updated_at: now
    }));

    if (isDryRun) {
      console.log(`\nWould insert ${recordsToUpsert.length} records:`);
      console.table(recordsToUpsert.map(r => ({
        ID: r.firestore_id,
        Name: r.name,
        Amount: r.amount,
        Category: r.category
      })));
    } else {
      console.log(`Inserting ${recordsToUpsert.length} records into Supabase...`);
      const { error } = await supabase.from("sevas").upsert(recordsToUpsert, { onConflict: "firestore_id" });

      if (error) {
        throw new Error(`Failed to insert sevas: ${error.message}`);
      }
      console.log("Successfully inserted sevas data.");
    }

    process.exit(0);
  } catch (error: any) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

run();
