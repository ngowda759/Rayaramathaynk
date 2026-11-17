import temple from "@/website-settings/temple.json";

export async function getTempleSettings() {
  return temple;
}

export async function updateTempleSettings(data: unknown) {
  // TODO: persist temple settings to Supabase (settings_documents).
  console.log("Saving temple settings", data);
}
