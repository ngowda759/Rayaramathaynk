import temple from "@/website-settings/temple.json";

export async function getTempleSettings() {
  return temple;
}

export async function updateTempleSettings(data: unknown) {
  // We'll replace this with Firestore later
  console.log("Saving temple settings", data);
}
