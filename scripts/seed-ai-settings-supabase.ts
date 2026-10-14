import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { getDefaultSeedPayload } from "../lib/ai/ai-settings/seed-data";

// Load environment variables from .env.local or .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export async function seedAISettings() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in environment variables.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log("Seeding Supabase ai_settings...");

  const payload = getDefaultSeedPayload("system");

  const { error } = await supabase
    .from("ai_settings")
    .upsert(payload, { onConflict: 'id', ignoreDuplicates: true });

  if (error) {
    console.error("Error seeding ai_settings:", error);
    process.exit(1);
  }

  console.log("Successfully seeded ai_settings.");
}

// Only run automatically if executed directly (not when imported for tests)
if (require.main === module) {
  seedAISettings().catch(console.error);
}
