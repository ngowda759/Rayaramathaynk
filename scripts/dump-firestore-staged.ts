import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { getAdminFirestore } from "../lib/admin-firebase";
import { resolveCredentials } from "./dump-firestore-live";

const ROOT = process.cwd();
const DD = path.join(ROOT, "data", "firestore-dump");
const NL = "\n";

async function runDumpStaged() {
  const args = process.argv.slice(2);
  const collectionsToDump = args.filter((a) => !a.startsWith("--"));

  if (collectionsToDump.length === 0) {
    console.error("FATAL: Usage: tsx scripts/dump-firestore-staged.ts <collection1> <collection2> ...");
    process.exit(1);
  }

  // Enforce Phase 1 scope: Only 'settings' and 'events' are allowed.
  const allowedCollections = new Set(["settings", "events"]);
  const invalidCollections = collectionsToDump.filter((c) => !allowedCollections.has(c));

  if (invalidCollections.length > 0) {
    console.error(`FATAL: Phase 1 migration is strictly limited to: settings, events.`);
    console.error(`Invalid collections requested: ${invalidCollections.join(", ")}`);
    process.exit(1);
  }

  console.log(`Starting Admin SDK staged dump for: ${collectionsToDump.join(", ")}`);

  fs.mkdirSync(DD, { recursive: true });

  let projectId = "unknown";
  try {
     const KEY = process.env.FIREBASE_SERVICE_ACCOUNT || path.join( ROOT, ".firebase-adminsdk.json" );
     projectId = resolveCredentials(process.env.FIREBASE_PROJECT_ID, process.env.FIREBASE_CLIENT_EMAIL, process.env.FIREBASE_PRIVATE_KEY, KEY).project_id;
  } catch(e) {
     // Ignored, getAdminFirestore will fail anyway if credentials are missing
  }

  const manifest: Record<string, any> = {
    projectId,
    exportedAt: new Date().toISOString(),
    requestedCollections: collectionsToDump,
    collections: {},
    success: false
  };

  try {
    const db = await getAdminFirestore();

    for (const c of collectionsToDump) {
      console.log(`Dumping collection: ${c}...`);

      let snapshot;
      try {
        snapshot = await db.collection(c).get();
      } catch (err: any) {
        console.error(`FATAL: Failed to read collection ${c}: ${err.message}`);
        process.exit(1);
      }

      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (docs.length === 0) {
         console.warn(`WARNING: Collection ${c} is empty.`);
      }

      const jsonContent = JSON.stringify(docs, null, 2) + NL;
      const hash = crypto.createHash('sha256').update(jsonContent, "utf8").digest('hex');

      fs.writeFileSync( path.join( DD, c + ".json" ), jsonContent );
      console.log( `DUMPED ${c}: ${docs.length} docs (SHA-256: ${hash})` );

      manifest.collections[c] = {
        status: "success",
        docCount: docs.length,
        hash
      };
    }

    manifest.success = true;
    fs.writeFileSync(path.join(DD, "manifest.json"), JSON.stringify(manifest, null, 2) + NL);
    console.log("Staged dump complete. Manifest written to data/firestore-dump/manifest.json");

  } catch (err: any) {
    console.error("FATAL: Failed to export collection via Admin SDK:", err.message);
    process.exit(1);
  }
}

if (process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('dump-firestore-staged.ts'))) {
  runDumpStaged().catch((err) => {
    console.error("FATAL: Unhandled promise rejection during dump:", err);
    process.exit(1);
  });
}
