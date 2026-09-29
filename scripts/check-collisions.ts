import { getAdminApp, getAdminFirestore } from "../lib/admin-firebase";
import fs from "fs";

async function main() {
  console.log("Starting Firestore collision diagnostic for 'aaradhane' and 'aaradhanes'...");
  let exitCode = 0;

  try {
    await getAdminApp();
    const db = await getAdminFirestore();

    const aaradhaneSnap = await db.collection("aaradhane").get();
    const aaradhanesSnap = await db.collection("aaradhanes").get();

    const aaradhaneIds = new Set(aaradhaneSnap.docs.map(doc => doc.id));
    const aaradhanesIds = new Set(aaradhanesSnap.docs.map(doc => doc.id));

    const collisions: string[] = [];
    for (const id of aaradhaneIds) {
      if (aaradhanesIds.has(id)) {
        collisions.push(id);
      }
    }

    const reportLines = [
      "=== Firestore Collision Diagnostic Report ===",
      `Date: ${new Date().toISOString()}`,
      "",
      `'aaradhane' collection count: ${aaradhaneSnap.size}`,
      `'aaradhanes' collection count: ${aaradhanesSnap.size}`,
      `Collisions found: ${collisions.length}`,
    ];

    if (collisions.length > 0) {
      reportLines.push("");
      reportLines.push("Collision IDs:");
      collisions.forEach(id => reportLines.push(`- ${id}`));
      exitCode = 1;
    }

    const reportContent = reportLines.join("\n");
    console.log(reportContent);
    fs.writeFileSync("collision-report.txt", reportContent);

    console.log("Wrote collision-report.txt");

  } catch (err: any) {
    console.error("Diagnostic failed unexpectedly:");
    console.error(err);
    exitCode = 2;
  }

  process.exit(exitCode);
}

main();
