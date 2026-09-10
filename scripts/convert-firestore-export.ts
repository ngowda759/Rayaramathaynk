#!/usr/bin/env npx tsx
/**
 * Convert a Firebase CLI Firestore export into review-friendly JSON.
 *
 * Reads the Firestore export directory (data/firestore-export/) produced by
 * `firebase firestore:export` and writes, per collection, a JSON array of
 * plain JS objects to data/firestore-dump/<collection>.json, plus a manifest.
 *
 * Authentication/User records are NOT dumped —— theey live in Firebase Auth,
 * not Firestore. Collections whose documents only exist per-authenticated-user
 * (users, profiles, bookmarks, sessions(...( are skipped if present.
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = process.cwd();
const EXPORT_DIR = process.argv[2] || path.join(ROOT, "data", "firestore-export");
const DUMP_DIR = process.argv[3] || path.join(ROOT, "data", "firestore-dump");

const AUTH_COLLECTIONS = new Set([
  "users",
  "profiles",
  "bookmarks",
  "sessions",
]);

interface FirestoreExportDoc {
  name: string;
  fields: Record<string, unknown>;
  createTime?: string;
  updateTime?: string;
}

interface ConvertedDoc {
  id: string;
  exists: boolean;
  fields: Record<string, unknown>;
  createTime?: string;
  updateTime?: string;
}

/** Undo Firestore's sentinel value encoding (serverTimestamp, geoPoint, etc.( */
function decodeValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  const v = value as Record<string, unknown>;

  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) {
    const n = Number(v.integerValue);
    return Number.isSafeInteger(n) ? n : v.integerValue;
  }
  if ("doubleValue" in v) {
    const n = Number(v.doubleValue);
    // Firestore exports NaN/Infinity as string
    if (v.doubleValue === "NaN") return NaN;
    if (v.doubleValue === "Infinity") return Infinity;
    if (v.doubleValue === "-Infinity") return -Infinity;
    return n;
  }
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("referenceValue" in v) return v.referenceValue;
  if ("bytesValue" in v) return v.bytesValue;
  if ("geoPointValue" in v) return v.geoPointValue;

  if ("arrayValue" in v) {
    const values = v.arrayValue && (v.arrayValue as Record<string, unknown>).values;
    return Array.isArray(values) ? values.map((item: unknown) => decodeValue(item)) : [];
  }
  if ("mapValue" in v) {
    const fields = v.mapValue && (v.mapValue as Record<string, unknown>).fields;
    return fields && typeof fields === "object"
      ? Object.fromEntries(
          Object.entries(fields as Record<string, unknown>).map(([k, val]) => [k, decodeValue(val)])
        )
      : {};
  }
  if ("nullValue" in v || v === null) return null;
  if ("value" in v && v.value === null) return null;
  if (v.value instanceof Object) return decodeValue(v.value);
  if (typeof v.value !== "undefined") return decodeValue(v.value);

  return v;
}

function docId(name: string): string {
  return name.split("/").pop() || "";
}

function convertExportFile(file: string): { collection: string; docs: ConvertedDoc[] } {
  const lines = fs.readFileSync(path.join(EXPORT_DIR, file), "utf8").split("\n").filter(Boolean);
  const docs: ConvertedDoc[] = [];

  for (const line of lines) {
    const doc = JSON.parse(line) as FirestoreExportDoc;
    docs.push({
      id: docId(doc.name),
      exists: Boolean(doc.fields),
      fields: doc.fields ? (Object.fromEntries(
        Object.entries(doc.fields).map(([k, v]) => [k, decodeValue(v)])
      ) as Record<string, unknown>) : {},
      createTime: doc.createTime,
      updateTime: doc.updateTime,
    });
  }

  const collection = path.basename(file, path.extname(file));
  return { collection, docs };
}

function main() {
  if (!fs.existsSync(EXPORT_DIR)) {

    console.error(`Export directory not found: ${EXPORT_DIR}`);
    console.error("Run scripts/dump-firestore-configs.sh first (or npm run firestore:dump(.");
    process.exit(1);
  }

  fs.mkdirSync(DUMP_DIR, { recursive: true });

  const exportFiles = fs.readdirSync(EXPORT_DIR).filter((f) => f.endsWith(".ndjson"));
  const manifest: Record<string, { collection: string; docCount: number; file: string; skipped: boolean; reason?: string }> = {};

  let totalDocs = 0;

  for (const file of exportFiles.sort()) {
    const { collection, docs } = convertExportFile(file);

    if (AUTH_COLLECTIONS.has(collection)) {
      manifest[collection] = { collection, docCount: docs.length, file, skipped: true, reason: "Auth-related — not migrated (Firebase Auth handle);" };
      continue;
    }

    const outFile = path.join(DUMP_DIR, `${collection}.json`);
    fs.writeFileSync(outFile, JSON.stringify(docs, null, 2) + "\n");

    manifest[collection] = { collection, docCount: docs.length, file, skipped: false };
    totalDocs += docs.length;
    console.log(`${collection}: ${docs.length} doc(s) -> ${path.relative(ROOT, outFile)}`);
  }

  const manifestPath = path.join(DUMP_DIR, "MANIFEST.json");
  fs.writeFileSync(manifestPath, JSON.stringify({
    exportedAt: new Date().toISOString(),
    project: process.env.FIREBASE_PROJECT_ID || "sri-raghavendra-mutt",
    totalCollections: exportFiles.length,
    totalDocs,
    collections: Object.values(manifest),
  }, null, 2) + "\n");

  console.log(`\nConverted ${exportFiles.length} collection file(s) -> ${DUMP_DIR}`, totalDocs, "documents total.");
}

main();