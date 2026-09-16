#!/usr/bin/env npx tsx

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { TEMPLE_AREAS } from "../types/temple-explorer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables. Please check .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const COLLECTION = "temple_areas";

async function seedTempleAreas() {
  console.log("Starting temple areas seeding to Supabase...");

  try {
    const { data: existingAreas, error: countError } = await supabase
      .from(COLLECTION)
      .select('id')
      .limit(1);

    if (countError && countError.code === '42P01') {
      console.log("Table does not exist. Please run the migration first.");
      return;
    } else if (countError) {
      console.error("Error checking collection:", countError);
      return;
    }

    if (existingAreas && existingAreas.length > 0) {
      console.log("Collection is not empty. Skip seeding.");
      return;
    }

    for (const area of TEMPLE_AREAS) {
      const id = area.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const { id: firestoreId, nameKannada, bestTimeToVisit, has360View, imageUrl, ...data } = area;

      const insertData = {
        id: id,
        firestore_id: firestoreId,
        name_kannada: nameKannada,
        best_time_to_visit: bestTimeToVisit,
        has360_view: has360View,
        image_url: imageUrl,
        ...data,
      };

      const { error } = await supabase.from(COLLECTION).upsert(insertData, { onConflict: "id" });

      if (error) {
        console.error(`Error seeding area ${id}:`, error);
      } else {
        console.log(`Seeded area: ${id}`);
      }
    }
    console.log("Seeding complete!");
  } catch (error) {
    console.error("Error seeding temple areas:", error);
  }
}

seedTempleAreas();
