import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { TEMPLE_AREAS } from "../types/temple-explorer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COLLECTION = "temple_areas";

async function seedTempleAreas() {
  console.log("Starting temple areas seeding...");

  try {
    const { data: existingAreas, error: countError } = await supabase
      .from(COLLECTION)
      .select('id')
      .limit(1);

    if (countError && countError.code === '42P01') {
      console.log("Table does not exist. Please run migration first.");
      return;
    } else if (countError) {
      console.error("Error checking collection:", countError);
    }

    if (existingAreas && existingAreas.length > 0) {
      console.log("Collection is not empty. Skip seeding.");
      return;
    }

    for (const area of TEMPLE_AREAS) {
      const { id, ...data } = area;
      await supabase.from(COLLECTION).upsert({
        firestore_id: id,
        ...data,
      }, { onConflict: "firestore_id" });
      console.log(`Seeded area: ${id}`);
    }
    console.log("Seeding complete!");
  } catch (error) {
    console.error("Error seeding temple areas:", error);
  }
}

seedTempleAreas();
