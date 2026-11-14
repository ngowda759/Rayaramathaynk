/**
 * Consolidated, Supabase-only initialization for missing `settings_documents` rows.
 *
 * Production was found to be missing several `settings_documents` keys that the
 * application reads. This module is the single, reviewed mechanism that fills the
 * missing rows from the canonical seed data already in the repository
 * (`SETTINGS_DOCUMENT_SEEDS`) without ever touching a populated row.
 *
 * Scope rules:
 *  - Only keys listed in `SETTINGS_INITIALIZATION_KEYS` are ever inserted. A key is
 *    listed only when it has canonical seed data in this repository AND a confirmed
 *    application consumer. Today that is `homepage` alone.
 *  - Every other key the investigation found missing is listed in
 *    `EXCLUDED_SETTINGS_KEYS` with the reason it is deliberately NOT seeded, so the
 *    operator sees the full picture and the decision is explicit rather than implicit.
 *  - Insertion is strictly insert-only: a row that already exists is left byte-for-byte.
 *    There is deliberately no `--force`/overwrite path — an owner-edited document can
 *    never be clobbered by this tool.
 *
 * It is pure: no Firestore, no `server-only`, no network, no credentials. The database
 * I/O is a small `SettingsInitPort` so the same logic runs against the real Supabase
 * admin client and against a PGlite test double.
 */

import { SETTINGS_DOCUMENT_SEEDS, type SettingsDocumentSeed } from "./settings-documents";

/**
 * The settings documents this initializer may insert.
 *
 * `homepage` is the only confirmed public-facing gap with canonical seed data: the
 * homepage components (`Hero`, `Panchanga`, `TempleTimings`) read
 * `settings_documents.document_key = 'homepage'` through `services/homepage.server.ts`,
 * and the canonical document already exists in `SETTINGS_DOCUMENT_SEEDS`. No other key
 * is added here until it has both canonical data and a confirmed consumer.
 */
export const SETTINGS_INITIALIZATION_KEYS: readonly string[] = ["homepage"];

/** A settings key deliberately left out of the initializer, with the reason. */
export interface ExcludedSettingsKey {
  key: string;
  reason: string;
}

/**
 * The keys the investigation found missing (or admin-only) that this initializer must
 * NOT create, each with the reason. Reported to the operator so the omission is a
 * documented decision, never an accident.
 */
export const EXCLUDED_SETTINGS_KEYS: readonly ExcludedSettingsKey[] = [
  {
    key: "guruParampara",
    reason:
      "no canonical Supabase seed document exists; the admin page's built-in defaults " +
      "(17 gurus) disagree with GURU_BIOGRAPHIES (18), so neither is proven canonical",
  },
  {
    key: "socialLinks",
    reason:
      "the admin page writes this document key but the public site reads the separate " +
      "`social_links` table, which already holds the owner's links; creating a document " +
      "would duplicate the source of truth (see the design note in the PR)",
  },
  {
    key: "shlokas",
    reason: "the public page reads `data/shlokas.ts`; the document is admin-only",
  },
  {
    key: "festivalCalendar",
    reason: "the public page reads `data/calendar.ts`; the document is admin-only",
  },
  {
    key: "ekadashiCalendar",
    reason: "the public page reads `data/calendar.ts`; the document is admin-only",
  },
  {
    key: "device",
    reason: "no live reader — the public map uses the built-in DEFAULT_DEVICE_SETTINGS",
  },
];

/** The seed document for a key, or `undefined` when no canonical seed exists. */
export function settingsSeedFor(key: string): SettingsDocumentSeed | undefined {
  return SETTINGS_DOCUMENT_SEEDS.find((seed) => seed.documentKey === key);
}

/**
 * Validate the initialization set before any database is touched: every allowlisted
 * key must have a canonical seed whose `data` is a non-empty plain object, and no key
 * may appear in both the allowlist and the exclusions. Returns the problems found;
 * an empty array means valid.
 */
export function validateSettingsInitialization(): string[] {
  const issues: string[] = [];
  const excluded = new Set(EXCLUDED_SETTINGS_KEYS.map((entry) => entry.key));

  if (SETTINGS_INITIALIZATION_KEYS.length === 0) {
    issues.push("SETTINGS_INITIALIZATION_KEYS must list at least one key");
  }

  const seen = new Set<string>();
  for (const key of SETTINGS_INITIALIZATION_KEYS) {
    if (seen.has(key)) issues.push(`SETTINGS_INITIALIZATION_KEYS lists "${key}" twice`);
    seen.add(key);
    if (excluded.has(key)) {
      issues.push(`"${key}" is both initialized and excluded`);
    }
    const seed = settingsSeedFor(key);
    if (!seed) {
      issues.push(`no canonical seed document exists for "${key}"`);
      continue;
    }
    if (!isRecord(seed.data) || Object.keys(seed.data).length === 0) {
      issues.push(`the canonical seed for "${key}" is not a non-empty object`);
    }
  }

  return issues;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Stable JSON with sorted keys, so two structurally equal documents compare equal. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** True when a stored document equals the canonical seed document. */
export function matchesSeed(existing: unknown, seed: SettingsDocumentSeed): boolean {
  return canonicalJson(existing) === canonicalJson(seed.data);
}

/**
 * Classify a stored `settings_documents` row for a key this initializer targets.
 *
 * - `missing`  — no row exists; the row is inserted.
 * - `matches`  — a row exists and already equals the canonical seed; nothing to do.
 * - `present`  — a row exists but differs (an owner edit); left untouched.
 *
 * Both `matches` and `present` result in "do not write": this tool never overwrites.
 */
export type SettingsRowState = "missing" | "matches" | "present";

export function classifySettingRow(existing: unknown, seed: SettingsDocumentSeed): SettingsRowState {
  if (existing === null || existing === undefined) return "missing";
  return matchesSeed(existing, seed) ? "matches" : "present";
}

export interface SettingsInitEntryPlan {
  documentKey: string;
  state: SettingsRowState;
  action: "insert" | "noop";
  reason: string;
}

/** The plan for one key, given the stored document (or `null`). */
export function planSettingInitialization(
  documentKey: string,
  existing: unknown
): SettingsInitEntryPlan {
  const seed = settingsSeedFor(documentKey);
  if (!seed) {
    // Only reachable when called with a key outside the allowlist; never insert.
    return {
      documentKey,
      state: "present",
      action: "noop",
      reason: "no canonical seed document exists; left untouched",
    };
  }
  const state = classifySettingRow(existing, seed);
  switch (state) {
    case "missing":
      return { documentKey, state, action: "insert", reason: "no row exists; it will be created" };
    case "matches":
      return {
        documentKey,
        state,
        action: "noop",
        reason: "the stored document already matches the canonical seed",
      };
    case "present":
      return {
        documentKey,
        state,
        action: "noop",
        reason: "a row already exists and differs; left untouched (this tool never overwrites)",
      };
  }
}

/**
 * The database I/O the initialization needs, injected so the orchestration is
 * unit-testable without a database. The real implementation reads/inserts
 * `settings_documents` with the Supabase admin client.
 */
export interface SettingsInitPort {
  /** The stored `data` for `document_key`, or `null` when absent. */
  readRow(documentKey: string): Promise<unknown | null>;
  /** Insert the canonical document for a missing key (must not overwrite an existing row). */
  insertRow(documentKey: string, data: Record<string, unknown>, fieldCount: number): Promise<void>;
}

export interface SettingsInitEntryResult extends SettingsInitEntryPlan {
  before: boolean;
  after: boolean;
  wrote: boolean;
}

export interface SettingsInitResult {
  entries: SettingsInitEntryResult[];
  inserted: string[];
  untouched: string[];
  wrote: boolean;
}

/**
 * Read each target row, insert only the missing ones (when `execute`), and verify the
 * result. `execute: false` is a dry run: it reads and reports but never writes.
 */
export async function runSettingsInitialization(
  port: SettingsInitPort,
  options: { execute: boolean; keys?: readonly string[] } = { execute: false }
): Promise<SettingsInitResult> {
  const keys = options.keys ?? SETTINGS_INITIALIZATION_KEYS;
  const entries: SettingsInitEntryResult[] = [];

  for (const key of keys) {
    const seed = settingsSeedFor(key);
    const existing = await port.readRow(key);
    const plan = planSettingInitialization(key, existing);
    const before = existing !== null && existing !== undefined;

    if (plan.action === "insert" && options.execute && seed) {
      await port.insertRow(key, seed.data, Object.keys(seed.data).length);
      const stored = await port.readRow(key);
      entries.push({
        ...plan,
        before,
        after: stored !== null && stored !== undefined,
        wrote: true,
      });
      continue;
    }

    entries.push({ ...plan, before, after: before, wrote: false });
  }

  return {
    entries,
    inserted: entries.filter((entry) => entry.wrote).map((entry) => entry.documentKey),
    untouched: entries.filter((entry) => !entry.wrote).map((entry) => entry.documentKey),
    wrote: entries.some((entry) => entry.wrote),
  };
}

/**
 * Verify that every key the run was supposed to insert now holds the canonical
 * document. Returns the keys that are still missing or incorrect; empty means the
 * write landed as expected.
 */
export async function verifySettingsInitialization(
  port: SettingsInitPort,
  keys: readonly string[] = SETTINGS_INITIALIZATION_KEYS
): Promise<string[]> {
  const failures: string[] = [];
  for (const key of keys) {
    const seed = settingsSeedFor(key);
    if (!seed) continue;
    const stored = await port.readRow(key);
    if (stored === null || stored === undefined) {
      failures.push(`${key}: still missing`);
    } else if (!matchesSeed(stored, seed)) {
      failures.push(`${key}: stored document does not match the canonical seed`);
    }
  }
  return failures;
}
