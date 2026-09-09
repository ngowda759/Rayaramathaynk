import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  const filePath = path.join(process.cwd(), "data", "exports", "supabase-events-all.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  console.log(`Found ${data.length} events in ${filePath}. Upserting...`);

  const { error } = await supabase.from("events").upsert(data, {
    onConflict: "firestore_id",
  });

  if (error) {
    console.error("Failed to migrate events:", error);
    process.exit(1);
  }

  console.log("Successfully migrated 38 events data to Supabase.");
}

migrate().catch(console.error);
