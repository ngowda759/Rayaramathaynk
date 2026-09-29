import { getAdminFirestore, initializeAdminApp } from "../lib/admin-firebase";

async function run() {
  await initializeAdminApp();
  const db = await getAdminFirestore();

  console.log("=== CHECKING COLLISIONS ===");

  const aSnap = await db.collection("aaradhane").get();
  const aDocs = aSnap.docs.map((d) => d.id);
  console.log(`aaradhane count: ${aDocs.length}`);

  const asSnap = await db.collection("aaradhanes").get();
  const asDocs = asSnap.docs.map((d) => d.id);
  console.log(`aaradhanes count: ${asDocs.length}`);

  const collisions = aDocs.filter((id) => asDocs.includes(id));
  console.log(`Collisions found: ${collisions.length}`);
  if (collisions.length > 0) {
    console.log("Collision IDs:", collisions);
    process.exit(1);
  }

  process.exit(0);
}

run().catch((e) => {
  console.error("Diagnostic script error:", e);
  process.exit(2);
});
