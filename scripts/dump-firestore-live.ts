import { JWT } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import { convertDoc, FirestoreWireDoc } from "./lib/firestore-values";

const ROOT = process.cwd();
const KEY = process.env.FIREBASE_SERVICE_ACCOUNT || path.join( ROOT, ".firebase-adminsdk.json" );
const ED = path.join( ROOT, "data", "firestore-export" );
const DD = path.join( ROOT, "data", "firestore-dump" );

const EXPECTED: ReadonlyArray< string > = [
  "aaradhane","aaradhanes","announcements","events","gallery","galleryAlbums","galleryMedia",
  "homepage","timings","sevas","testimonials","temple_areas","dailyPoojas","poojas",
  "panchanga","quotes","featuredContent","settings","futurePlans","trustCommittee","trust",
  "sevaBookings","donations","donationCampaigns","donation_campaigns","bills","receiptSevas",
  "receipts","system","volunteers","volunteer_requests","members","ai_settings","ai_token_usage",
  "ai_latency_records","ai_intent_distribution","ai_unknown_questions","chat_sessions","chat_messages",
  "messages","chatTraining","chat_metrics","intent_metrics","intent_feedback","unknown_questions",
  "page_views","daily_page_stats","feedback","notifications","knowledge","knowledge_articles",
  "knowledge_categories","knowledge_workflow","knowledge_versions","knowledge_workflow_actions",
  "knowledge_review_comments","knowledge_committee_approvals","knowledge_audit_log","knowledge_drafts",
];
const EXCLUDED: ReadonlyArray< string > = [ "users","profiles","bookmarks","sessions" ];

const NL = String.fromCharCode( 10 );
const k = JSON.parse( fs.readFileSync( KEY, "utf8" ) );
const client = new JWT( { email: k.client_email, key: k.private_key, scopes: [ "https://www.googleapis.com/auth/datastore" ] } );
const base = "https://firestore.googleapis.com/v1/projects/" + k.project_id + "/databases/(default)/documents";

async function main() {
  const tok = await client.getAccessToken();
  const H = { Authorization: "Bearer " + tok.token };

async function collectionIds(): Promise< string[] > {
  let jj2 = null;
  for ( let attempt = 0; attempt < 48; attempt++ ) {
    const r = await fetch( base + ":listCollectionIds", { method: "POST", headers: H } );
    if ( r.ok ) { jj2 = await r.json(); break; }
    const wait = 3000 * ( attempt + 1 );
    console.log( "listCollectionIds HTTP " + r.status + " retry in " + wait/1000 + "s" );
    await new Promise( ( r2 ) => setTimeout( r2, wait ) );
  }
  if ( jj2 === null ) throw new Error( "listCollectionIds failed after retries" );
  const j = jj2 as { collectionIds?: string[] };
  return j.collectionIds || [];
}

async function listAll( col: string ): Promise< FirestoreWireDoc[] > {
  const out: Array< FirestoreWireDoc > = [];
  const seen = new Set< string >();
  let url = base + "/" + encodeURIComponent( col ) + "?pageSize=300";
  let guard = 0;
  while ( url && guard < 1000 ) {
    let body: { documents?: FirestoreWireDoc[]; nextPageToken?: string; } | null = null;
    let ok = false;
    for ( let attempt = 0; attempt < 5 && !ok; attempt++ ) {
      try {
        const ac = new AbortController();
        const tm = setTimeout( ( ) => ac.abort(), 90000 );
        const rr = await fetch( url, { headers: H, signal: ac.signal } );
        clearTimeout( tm );
        if ( rr.status === 429 || rr.status >= 500 ) {
          const wait = 2000 * Math.pow( 2, attempt );
          console.log( "  " + col + " HTTP " + rr.status + " retry in " + wait/1000 + "s" );
          await new Promise( ( r ) => setTimeout( r, wait ) );
          continue;
        }
        if ( !rr.ok ) throw new Error( col + " list failed: " + rr.status + " " + await rr.text() );
        const jj = await rr.json() as { documents?: FirestoreWireDoc[]; nextPageToken?: string };
        for ( const d of ( jj.documents || [] ) ) {
          if ( seen.has( d.name ) ) continue;
          seen.add( d.name );
          out.push( d );
        }
        url = jj.nextPageToken ? base + "/" + encodeURIComponent( col ) + "?pageSize=300&pageToken=" + encodeURIComponent( jj.nextPageToken ) : "0";
        body = jj;
        ok = true;
      } catch ( e ) {
        const m = e instanceof Error ? ( e.name === "AbortError" ? "timeout after 90s" : String( e ) ) : String( e );
        if ( attempt === 4 ) {
          console.error( "  FAILED " + col + ": " + m ); failed.set( col,m ); ok = true;
        }
        console.log( "  " + col + " attempt " + attempt + " failed: " + m + " retrying" );
        await new Promise( ( r ) => setTimeout( r, 5000 * ( attempt + 1 ) ) );
      }
    }
    if ( body === null ) { failed.set( col,"pagination exhausted before completion" ); break; }
    guard++;
  }
  return out;
}
const ids = ( await collectionIds() ).sort();
fs.mkdirSync( ED, { recursive: true } );
fs.mkdirSync( DD, { recursive: true } );

const present = new Map< string, number >();
const failed = new Map< string, string >();
for ( const c of ids ) {
  if ( EXCLUDED.includes( c ) ) { console.log( "SKIP excluded " + c ); continue; }
  const docs = await listAll( c );
  if ( failed.has( c ) ) { continue; }
  if ( docs.length === 0 && !EXPECTED.includes( c ) ) { console.log( "SKIP empty-unexpected " + c ); continue; }
  const wire = docs.map( ( d ) => JSON.stringify( d ) );
  fs.writeFileSync( path.join( ED, c + ".ndjson" ), wire.join( NL ) + ( wire.length ? NL : "" ) );
  const arr = docs.map( convertDoc );
  fs.writeFileSync( path.join( DD, c + ".json" ), JSON.stringify( arr, null, 2 ) + NL );
  present.set( c, docs.length );
  console.log( "DUMPED " + c + ": " + docs.length + " docs" );
}

const collections: Array< Record< string, unknown > > = [];
let totalDocs = 0;
for ( const [ c, n ] of present ) {
  collections.push( { collection: c, status: "present", docCount: n, file: c + ".ndjson" } );
  totalDocs += n;
}
const missing: Array< string > = [];
for ( const c of EXPECTED ) if ( !present.has( c ) && !EXCLUDED.includes( c ) && !failed.has( c ) ) missing.push( c );
for ( const c of missing ) collections.push( { collection: c, status: "expected-known-missing", docCount: 0, file: null, reason: "Known from code/rules but not live: verify empty" } );
for ( const c of EXCLUDED ) if ( present.has( c ) ) collections.push( { collection: c, status: "intentionallyExcluded", docCount: present.get( c ), file: c + ".ndjson", reason: "Auth-related: owned by Firebase Auth, excluded from dump/migration" } );
for ( const [ c,n ] of present ) if ( !EXPECTED.includes( c ) && !EXCLUDED.includes( c ) ) collections.push( { collection: c, status: "unexpected", docCount: n, file: c + ".ndjson", reason: "Found live but not in code/rules: verify" } );
for ( const [ c,r ] of failed ) collections.push( { collection: c, status: "failed", docCount: 0, file: null, reason: r } );

if ( missing.length ) {
  console.warn( "WARNING: expected-known collections not found live: " + missing.join( ", " ) );
} else {
  console.log( "All " + EXPECTED.length + " expected-known collections accounted for." );
}
if ( failed.size >  0 ) {
  console.error( "FAILED collections (" + failed.size + "):" );
  for ( const [ c,r ] of failed ) console.error( "  - " + c + ": " + r );
}
fs.writeFileSync( path.join( DD,"MANIFEST.json" ), JSON.stringify( { exportedAt: new Date().toISOString(), project: k.project_id, discoveredCollections: ids.length, totalCollections: present.size, totalDocs, totalFailed: failed.size, collections }, null, 2 ) + NL );
console.log( "Live dump complete: " + present.size + " dumped, " + failed.size + " failed, " + totalDocs + " docs, " + ED + " / " + DD );
if ( failed.size >  0 ) process.exitCode =  1;
}
main().catch( ( e ) => {
  const m = e instanceof Error ? String( e ) : String( e );
  console.error( "FATAL: " + m );
  fs.mkdirSync( DD, { recursive: true } );
  fs.writeFileSync( path.join( DD,"MANIFEST.json" ), JSON.stringify( { exportedAt: new Date().toISOString(), project: k.project_id, discoveredCollections: 0, totalCollections:  0, totalDocs:  0, totalFailed:  1, collections: [ { collection: "(fatal)", status: "failed", docCount:  0, file: null, reason: m } ] }, null,2 ) + NL );
  process.exitCode =  1;
} );
