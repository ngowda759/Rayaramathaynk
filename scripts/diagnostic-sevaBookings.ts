import { getAdminApp, getAdminFirestore } from "../lib/admin-firebase";

async function main() {
  await getAdminApp();
  const db = await getAdminFirestore();

  const snapshot = await db.collection("sevaBookings").get();
  console.log(`Found ${snapshot.docs.length} documents.`);

  for (const doc of snapshot.docs) {
    const id = doc.id;
    const data = doc.data();

    if (id === "Ce6SDXl3HL9ReOgHZZis") {
      const redacted = { ...data };
      if (redacted.userEmail) redacted.userEmail = "***";
      if (redacted.userPhone) redacted.userPhone = "***";
      if (redacted.paymentReference) redacted.paymentReference = "***";
      if (redacted.userName) redacted.userName = "***";
      if (redacted.userId) redacted.userId = "***";
      console.log("\n=== INSPECTING PROBLEMATIC DOCUMENT (Ce6SDXl3HL9ReOgHZZis) ===");
      console.log(JSON.stringify(redacted, null, 2));
    } else {
      console.log(`\n=== VALID DOC KEYS (${id}) ===`);
      console.log(JSON.stringify(Object.keys(data)));
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
