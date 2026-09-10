/**
 * Shared Firestore wire-format helpers for the dump pipeline.
 *
 * Firestore REST exports use the "Value" proto encoding:
 *   { "stringValue": "...", "integerValue": "42", "mapValue": { "fields": {...} }, ... }
 * These helpers decode that encoding into plain JSON values so the dumps are
 * easy to review and migrate to Supabase.
 */

/** Decode a single Firestore `Value` object into a plain JS value. */
export function decodeValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  const v = value as Record<string, unknown>;

  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) {
    const n = Number(v.integerValue);
    return Number.isSafeInteger(n) ? n : v.integerValue;
  }
  if ("doubleValue" in v) {
    const raw = v.doubleValue;
    if (raw === "NaN") return NaN;
    if (raw === "Infinity") return Infinity;
    if (raw === "-Infinity") return -Infinity;
    return Number(raw);
  }
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue; // ISO-8601 string
  if ("referenceValue" in v) return v.referenceValue; // full resource path
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
  if ("nullValue" in v) return null;

  return v;
}

/** Extract the document id from a full Firestore resource name. */
export function docId(name: string): string {
  return name.split("/").pop() || "";
}

export interface FirestoreWireDoc {
  name: string;
  fields?: Record<string, unknown>;
  createTime?: string;
  updateTime?: string;
}

export function convertDoc(doc: FirestoreWireDoc): Record<string, unknown> {
  return {
    id: docId(doc.name),
    exists: Boolean(doc.fields),
    fields: doc.fields
      ? (Object.fromEntries(
          Object.entries(doc.fields as Record<string, unknown>).map(([k, v]) => [k, decodeValue(v)])
        ) as Record<string, unknown>)
      : {},
    createTime: doc.createTime,
    updateTime: doc.updateTime,
  };
}

/** Human status line bez em-dashes/arrows for ASCII-clean logs. */
export const STATUS_OK = "OK";
export const STATUS_SKIPPED = "SKIPPED";
export const STATUS_MISSING = "MISSING";
export const STATUS_NEW = "NEW";