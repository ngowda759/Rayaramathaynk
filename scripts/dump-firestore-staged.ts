import { JWT } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import { convertDoc, FirestoreWireDoc } from "./lib/firestore-values";
import { fetchCollectionListAll, FIRESTORE_MAX_RETRIES, FIRESTORE_MAX_BACKOFF_MS, resolveCredentials, globalPacer } from "./dump-firestore-live";

const ROOT = process.cwd();
const KEY = process.env.FIREBASE_SERVICE_ACCOUNT || path.join( ROOT, ".firebase-adminsdk.json" );
const ED = path.join( ROOT, "data", "firestore-export" );
const DD = path.join( ROOT, "data", "firestore-dump" );

const NL = String.fromCharCode( 10 );

async function runDumpStaged() {
  const args = process.argv.slice(2);
  const collectionsToDump = args.filter(a => !a.startsWith('--'));

  if (collectionsToDump.length === 0) {
    console.error("Usage: tsx scripts/dump-firestore-staged.ts <collection1> <collection2> ...");
    process.exit(1);
  }

  let k;
  let client: JWT;
  let base: string;

  try {
    k = resolveCredentials(
      process.env.FIREBASE_PROJECT_ID,
      process.env.FIREBASE_CLIENT_EMAIL,
      process.env.FIREBASE_PRIVATE_KEY,
      KEY
    );

    client = new JWT( { email: k.client_email, key: k.private_key, scopes: [ "https://www.googleapis.com/auth/datastore" ] } );
    globalPacer.setClient(client);
    base = "https://firestore.googleapis.com/v1/projects/" + k.project_id + "/databases/(default)/documents";
  } catch (e) {
    const m = e instanceof Error ? String( e ) : String( e );
    console.error( "FATAL: " + m );
    process.exit(1);
  }

  fs.mkdirSync( ED, { recursive: true } );
  fs.mkdirSync( DD, { recursive: true } );

  const present = new Map< string, number >();
  const failed = new Map< string, string >();

  for ( const c of collectionsToDump ) {
    console.log(`Dumping collection: ${c}...`);
    const docs = await fetchCollectionListAll(c, base, failed);

    if ( failed.has( c ) ) {
      console.error(`Failed to dump ${c}: ${failed.get(c)}`);
      continue;
    }

    const wire = docs.map( ( d ) => JSON.stringify( d ) );
    fs.writeFileSync( path.join( ED, c + ".ndjson" ), wire.join( NL ) + ( wire.length ? NL : "" ) );
    const arr = docs.map( convertDoc );
    fs.writeFileSync( path.join( DD, c + ".json" ), JSON.stringify( arr, null, 2 ) + NL );
    present.set( c, docs.length );
    console.log( "DUMPED " + c + ": " + docs.length + " docs" );
  }
}

// In tsx, require.main === module is problematic, so let's just run it if we are being executed directly
if (process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('dump-firestore-staged.ts'))) {
  runDumpStaged().catch(console.error);
}
