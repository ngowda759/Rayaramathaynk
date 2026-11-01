// Validate age encryption public keys before any production database work.
//
// The F-A16 workflow encrypts its catalog output before uploading it to this
// PUBLIC repository, so a missing or malformed recipient must stop the run
// BEFORE the database is reached — not after, when the only options are to
// upload plaintext or lose the run. A `case "$key" in *age1*)` check is not
// enough: it accepts `not-an-age1-key`, `AGE1…`, a key with a single corrupted
// character, and any string that merely contains "age1".
//
// This module validates the real structure: bech32 (BIP-173) with HRP `age`,
// the fixed 62-character length, and a recomputed checksum. When the `age`
// binary is on PATH it also performs a functional check (`age -r <key>` on empty
// input), which is the tooling itself agreeing the key is a recipient.
//
// It never prints a key: only a count and a non-reversible fingerprint.
//
// Usage: node scripts/lib/age-recipient.mjs [ENV_VAR_NAME]
//   Default env var: F_A16_AUDIT_AGE_RECIPIENT, falling back to
//   SEVA_BACKUP_AGE_RECIPIENT when the former is empty.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const AGE_RECIPIENT_LENGTH = 62; // "age1" + 58 bech32 characters

function polymod(values) {
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GENERATOR[i];
  }
  return chk;
}

function hrpExpand(hrp) {
  const out = [];
  for (const c of hrp) out.push(c.charCodeAt(0) >> 5);
  out.push(0);
  for (const c of hrp) out.push(c.charCodeAt(0) & 31);
  return out;
}

function decodeDataPart(s) {
  const out = [];
  for (const c of s) {
    const i = CHARSET.indexOf(c);
    if (i === -1) return null;
    out.push(i);
  }
  return out;
}

/** A short, non-reversible fingerprint. A SHA-256 prefix cannot be reversed. */
export function fingerprint(value) {
  const v = String(value ?? "");
  if (!v) return "(empty)";
  return createHash("sha256").update(v).digest("hex").slice(0, 12);
}

/**
 * Validate a single age X25519 recipient.
 *
 * Returns `{ ok: true }` or `{ ok: false, reason }`. Rejects anything that is
 * not exactly `age1` + 58 lower-case bech32 characters with a valid checksum.
 */
export function validateAgeRecipient(key) {
  if (typeof key !== "string" || key.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (key !== key.toLowerCase()) return { ok: false, reason: "not lower-case" };
  const sep = key.lastIndexOf("1");
  if (sep < 1) return { ok: false, reason: "no bech32 separator" };
  const hrp = key.slice(0, sep);
  if (hrp !== "age") return { ok: false, reason: `unexpected prefix "${hrp}"` };
  const data = decodeDataPart(key.slice(sep + 1));
  if (data === null) return { ok: false, reason: "invalid bech32 character" };
  if (key.length !== AGE_RECIPIENT_LENGTH) {
    return { ok: false, reason: `length ${key.length}, expected ${AGE_RECIPIENT_LENGTH}` };
  }
  if (polymod([...hrpExpand(hrp), ...data]) !== 1) {
    return { ok: false, reason: "invalid bech32 checksum" };
  }
  return { ok: true };
}

/**
 * Split a secret that may hold several recipients (spaces, tabs, new lines and
 * commas all separate them) and validate every one. The whole value is rejected
 * if any entry is not a valid recipient — a partly-valid secret must not be used.
 */
export function parseAgeRecipients(value) {
  const parts = String(value ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) return { ok: false, reason: "no recipients", recipients: [] };
  for (const key of parts) {
    const v = validateAgeRecipient(key);
    if (!v.ok) return { ok: false, reason: `${v.reason} (fingerprint ${fingerprint(key)})`, recipients: [] };
  }
  return { ok: true, recipients: parts };
}

/** Functional check with the real `age` tooling, when it is on PATH. */
export function ageToolingAccepts(key) {
  const probe = spawnSync("age", ["-r", key], { input: "", encoding: "utf8" });
  if (probe.error && probe.error.code === "ENOENT") return { available: false };
  return { available: true, ok: probe.status === 0 };
}

function main() {
  const explicitVar = process.argv[2];
  const names = explicitVar
    ? [explicitVar]
    : ["F_A16_AUDIT_AGE_RECIPIENT", "SEVA_BACKUP_AGE_RECIPIENT"];

  let value = "";
  let usedVar = "";
  for (const name of names) {
    const v = String(process.env[name] ?? "").trim();
    if (v) {
      value = v;
      usedVar = name;
      break;
    }
  }

  if (!value) {
    console.error(
      `REFUSING: no age recipient is set (checked ${names.join(", ")}). ` +
        "Catalog output must be encrypted before it is uploaded to a public repository."
    );
    process.exit(1);
  }

  const parsed = parseAgeRecipients(value);
  if (!parsed.ok) {
    console.error(
      `REFUSING: ${usedVar} is not a valid age public key — ${parsed.reason}. ` +
        "Expected an age X25519 recipient: age1 + 58 lower-case bech32 characters."
    );
    process.exit(1);
  }

  // Belt and braces: if the real tooling is present, let it agree.
  for (const key of parsed.recipients) {
    const res = ageToolingAccepts(key);
    if (res.available && !res.ok) {
      console.error(
        `REFUSING: the age tooling rejected a recipient (fingerprint ${fingerprint(key)}).`
      );
      process.exit(1);
    }
  }

  console.log(
    `Age recipient validation passed: ${parsed.recipients.length} key(s) from ${usedVar}, ` +
      `fingerprint(s) ${parsed.recipients.map(fingerprint).join(", ")}.`
  );
  process.exit(0);
}

// Run as a CLI only when invoked directly, so the module can be imported by tests.
if (process.argv[1] && process.argv[1].endsWith("age-recipient.mjs")) {
  main();
}
