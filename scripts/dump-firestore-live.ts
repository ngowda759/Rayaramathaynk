import { JWT } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import { convertDoc, FirestoreWireDoc } from "./lib/firestore-values";

export const FIRESTORE_PAGE_SIZE = 100;
export const FIRESTORE_MIN_REQUEST_INTERVAL_MS = 500;
export const FIRESTORE_MAX_RETRIES = 10;
export const FIRESTORE_MAX_BACKOFF_MS = 120000;

class FirestorePacer {
  private _client: import("google-auth-library").JWT | null = null;
  private _cachedToken: string | null = null;
  private _tokenExpiry: number = 0;

  setClient(client: import("google-auth-library").JWT) {
    this._client = client;
  }

  async getAuthHeader(): Promise<Record<string, string>> {
    if (!this._client) throw new Error("Auth client not configured");
    const now = Date.now();
    // Refresh token if missing or expiring within 5 minutes (300000ms)
    if (!this._cachedToken || this._tokenExpiry < now + 300000) {
      console.log("Fetching new Firebase access token...");
      const tok = await this._client.getAccessToken();
      if (!tok.token) throw new Error("Failed to obtain access token");
      this._cachedToken = tok.token;
      // Assume typical 1 hour expiry if not provided, but usually tokens are valid for ~1hr. We'll set expiry conservatively.
      // Wait, getAccessToken returns { token, res? } not sure about expiry time. We'll just refresh if 401.
      // Actually google-auth-library tokens often have an expiry date, but it's not strongly typed here.
      // We'll rely on the 401 retry to force a refresh if we guess wrong.
      this._tokenExpiry = now + 3600 * 1000;
    }
    return { Authorization: "Bearer " + this._cachedToken };
  }

  invalidateToken() {
    console.log("Invalidating cached access token...");
    this._cachedToken = null;
    this._tokenExpiry = 0;
  }

  private nextRequestTime = 0;
  private currentDelayMs = FIRESTORE_MIN_REQUEST_INTERVAL_MS;

  async throttle(): Promise<void> {
    const now = Date.now();
    if (this.nextRequestTime > now) {
      const delay = this.nextRequestTime - now;
      console.log(`global request delay: ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  afterRequest(): void {
    this.nextRequestTime = Date.now() + this.currentDelayMs;
  }

  scheduleRetry(waitMs: number): void {
    this.nextRequestTime = Math.max(this.nextRequestTime, Date.now() + waitMs);
  }

  record429(waitMs: number): void {
    this.scheduleRetry(waitMs);
    // Increase global delay to slow down hammering
    this.currentDelayMs = Math.min(5000, this.currentDelayMs + 500);
  }

  async fetch(url: string, init?: RequestInit): Promise<Response> {
    await this.throttle();
    let headers = { ...(init?.headers || {}), ...(await this.getAuthHeader()) };
    let result = await fetch(url, { ...init, headers });

    // Check for 401 (token expiration)
    if (result.status === 401) {
      this.invalidateToken();
      // Retry once immediately after invalidating
      headers = { ...(init?.headers || {}), ...(await this.getAuthHeader()) };
      result = await fetch(url, { ...init, headers });
    }

    this.afterRequest();
    return result;
  }
}

export const globalPacer = new FirestorePacer();




export async function fetchCollectionListAll(col: string, base: string, failed: Map<string, string>): Promise<FirestoreWireDoc[]> {
  const out: Array<FirestoreWireDoc> = [];
  const seen = new Set<string>();
  let url = base + "/" + encodeURIComponent(col) + "?pageSize=" + FIRESTORE_PAGE_SIZE;
  let guard = 0;

  while (url && guard < 1000) {
    let body: { documents?: FirestoreWireDoc[]; nextPageToken?: string; } | null = null;
    let ok = false;
    for (let attempt = 0; attempt < FIRESTORE_MAX_RETRIES && !ok; attempt++) {
      let tm: NodeJS.Timeout | undefined;
      try {
        const ac = new AbortController();
        tm = setTimeout(() => ac.abort(), 90000);
        let rr: Response;
        try {
          rr = await globalPacer.fetch(url, { signal: ac.signal });
        } finally {
          if (tm) clearTimeout(tm);
        }

        if (rr.status === 429) {
          const retryAfter = rr.headers.get("Retry-After");
          let wait = NaN;
          if (retryAfter) {
            const delayStr = parseInt(retryAfter, 10);
            if (!isNaN(delayStr)) {
              wait = delayStr * 1000;
            } else {
              const parsedDate = Date.parse(retryAfter);
              if (!isNaN(parsedDate)) {
                wait = Math.max(0, parsedDate - Date.now());
              }
            }
          }
          if (isNaN(wait)) {
            wait = 2000 * Math.pow(2, attempt) + Math.random() * 1000;
            wait = Math.min(wait, FIRESTORE_MAX_BACKOFF_MS);
          }
          if (attempt === FIRESTORE_MAX_RETRIES - 1) {
            throw new Error("HTTP 429 after 10 attempts");
          }

          console.log("  " + col + " HTTP " + rr.status + " retry " + (attempt + 1) + "/" + FIRESTORE_MAX_RETRIES + " in " + Math.round(wait / 1000) + "s");
          globalPacer.record429(wait);
          continue;
        }

        if (rr.status >= 500) {
          if (attempt === FIRESTORE_MAX_RETRIES - 1) {
             throw new Error("HTTP " + rr.status + " after " + FIRESTORE_MAX_RETRIES + " attempts");
          }
          let wait = 2000 * Math.pow(2, attempt) + Math.random() * 1000;
          wait = Math.min(wait, FIRESTORE_MAX_BACKOFF_MS);
          console.log("  " + col + " HTTP " + rr.status + " retry " + (attempt + 1) + "/" + FIRESTORE_MAX_RETRIES + " in " + Math.round(wait / 1000) + "s");
          globalPacer.scheduleRetry(wait);
          continue;
        }

        if (rr.status >= 400 && rr.status < 500 && rr.status !== 429) {
          const errText = await rr.text();
          failed.set(col, "permanent HTTP " + rr.status);
          throw new Error(col + " list failed permanently: " + rr.status + " " + errText);
        }

        if (!rr.ok) throw new Error(col + " list failed: " + rr.status + " " + await rr.text());

        const jj = await rr.json() as { documents?: FirestoreWireDoc[]; nextPageToken?: string };
        for (const d of (jj.documents || [])) {
          if (seen.has(d.name)) continue;
          seen.add(d.name);
          out.push(d);
        }
        url = jj.nextPageToken ? base + "/" + encodeURIComponent(col) + "?pageSize=" + FIRESTORE_PAGE_SIZE + "&pageToken=" + encodeURIComponent(jj.nextPageToken) : "";
        body = jj;
        ok = true;
      } catch (e) {
        const m = e instanceof Error ? (e.name === "AbortError" ? "timeout after 90s" : String(e)) : String(e);
        if (attempt === FIRESTORE_MAX_RETRIES - 1 || m.includes("failed permanently")) {
          console.error("  FAILED " + col + ": " + m);
          if (!failed.has(col)) failed.set(col, m);
          // Don't keep retrying pagination if this failed completely
          break;
        } else {
          console.log("  " + col + " attempt " + (attempt + 1) + " failed: " + m + " retrying");
          let wait = 5000 * (attempt + 1) + Math.random() * 1000;
          wait = Math.min(wait, FIRESTORE_MAX_BACKOFF_MS);
          globalPacer.scheduleRetry(wait);
        }
      }
    }
    if (body === null) {
      if (!failed.has(col)) failed.set(col, "pagination exhausted before completion");
      break;
    }
    if (failed.has(col)) {
      break;
    }
    guard++;
  }
  if (!failed.has(col)) {
    console.log(`collection completed: ${out.length} docs`);
  }
  return out;
}


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

export interface FirebaseCredentials {
  project_id: string;
  client_email: string;
  private_key: string;
}

export function resolveCredentials(
  envProjectId?: string,
  envClientEmail?: string,
  envPrivateKey?: string,
  keyFilePath?: string
): FirebaseCredentials {
  if (envProjectId && envClientEmail && envPrivateKey) {
    return {
      project_id: envProjectId,
      client_email: envClientEmail,
      private_key: envPrivateKey
        .replace(/\\n/g, "\n")
        .replace(/\r\n/g, "\n")
        .replace(/^\s+|\s+$/g, "")
        .replace(/-----BEGIN PRIVATE KEY-----\s*/, "-----BEGIN PRIVATE KEY-----\n")
        .replace(/\s*-----END PRIVATE KEY-----/, "\n-----END PRIVATE KEY-----"),
    };
  } else if (keyFilePath && fs.existsSync(keyFilePath)) {
    return JSON.parse( fs.readFileSync( keyFilePath, "utf8" ) );
  } else {
    throw new Error("Missing Firebase credentials. Please provide FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables, or a valid service account file.");
  }
}

async function runDump() {
  let k: FirebaseCredentials | undefined;
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
    fs.mkdirSync( DD, { recursive: true } );
    fs.writeFileSync( path.join( DD,"MANIFEST.json" ), JSON.stringify( { exportedAt: new Date().toISOString(), project: k ? k.project_id : 'unknown', discoveredCollections: 0, totalCollections:  0, totalDocs:  0, totalFailed:  1, collections: [ { collection: "(fatal)", status: "failed", docCount:  0, file: null, reason: m } ] }, null,2 ) + NL );
    process.exit(1);
  }

  // Token fetching handled dynamically by FirestorePacer

  async function collectionIds(): Promise< string[] > {
    let jj2 = null;
    let ok = false;
    for ( let attempt = 0; attempt < FIRESTORE_MAX_RETRIES && !ok; attempt++ ) {
      try {
        const ac = new AbortController();
        const tm = setTimeout(() => ac.abort(), 90000);
        let r: Response;
        try {
          r = await globalPacer.fetch( base + ":listCollectionIds", { method: "POST", signal: ac.signal } );
        } finally {
          clearTimeout(tm);
        }

        if ( r.ok ) {
          jj2 = await r.json();
          ok = true;
          break;
        }

        if (r.status === 429) {
          const retryAfter = r.headers.get("Retry-After");
          let wait = NaN;
          if (retryAfter) {
            const delayStr = parseInt(retryAfter, 10);
            if (!isNaN(delayStr)) wait = delayStr * 1000;
            else {
              const parsedDate = Date.parse(retryAfter);
              if (!isNaN(parsedDate)) wait = Math.max(0, parsedDate - Date.now());
            }
          }
          if (isNaN(wait)) {
            wait = 2000 * Math.pow(2, attempt) + Math.random() * 1000;
            wait = Math.min(wait, FIRESTORE_MAX_BACKOFF_MS);
          }
          console.log("listCollectionIds HTTP " + r.status + " retry " + (attempt + 1) + "/" + FIRESTORE_MAX_RETRIES + " in " + Math.round(wait/1000) + "s");
          globalPacer.record429(wait);
          continue;
        }

        if (r.status >= 500) {
          let wait = 2000 * Math.pow(2, attempt) + Math.random() * 1000;
          wait = Math.min(wait, FIRESTORE_MAX_BACKOFF_MS);
          console.log("listCollectionIds HTTP " + r.status + " retry " + (attempt + 1) + "/" + FIRESTORE_MAX_RETRIES + " in " + Math.round(wait/1000) + "s");
          globalPacer.scheduleRetry(wait);
          continue;
        }

        if (r.status >= 400 && r.status < 500 && r.status !== 429) {
          throw new Error("listCollectionIds failed permanently: " + r.status + " " + await r.text());
        }

      } catch (e) {
        const m = e instanceof Error ? (e.name === "AbortError" ? "timeout after 90s" : String(e)) : String(e);
        if (attempt === FIRESTORE_MAX_RETRIES - 1 || m.includes("failed permanently")) {
           throw new Error("listCollectionIds failed: " + m);
        } else {
           console.log("listCollectionIds attempt " + (attempt + 1) + " failed: " + m + " retrying");
           let wait = 5000 * (attempt + 1) + Math.random() * 1000;
           wait = Math.min(wait, FIRESTORE_MAX_BACKOFF_MS);
           globalPacer.scheduleRetry(wait);
        }
      }
    }
    if ( jj2 === null ) throw new Error( "listCollectionIds failed after retries" );
    const j = jj2 as { collectionIds?: string[] };
    return j.collectionIds || [];
  }

  async function listAll( col: string ): Promise< FirestoreWireDoc[] > {
    return await fetchCollectionListAll(col, base, failed);
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

if (process.argv[1] === __filename || process.argv[1].endsWith('dump-firestore-live.ts')) {
  runDump().catch( ( e ) => {
    const m = e instanceof Error ? String( e ) : String( e );
    console.error( "FATAL: " + m );
    fs.mkdirSync( DD, { recursive: true } );
    let project = 'unknown';
    try { project = resolveCredentials(process.env.FIREBASE_PROJECT_ID, process.env.FIREBASE_CLIENT_EMAIL, process.env.FIREBASE_PRIVATE_KEY, KEY).project_id; } catch { /* ignore */ }
    fs.writeFileSync( path.join( DD,"MANIFEST.json" ), JSON.stringify( { exportedAt: new Date().toISOString(), project, discoveredCollections: 0, totalCollections:  0, totalDocs:  0, totalFailed:  1, collections: [ { collection: "(fatal)", status: "failed", docCount:  0, file: null, reason: m } ] }, null,2 ) + NL );
    process.exitCode =  1;
  } );
}
