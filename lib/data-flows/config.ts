/**
 * Credential resolution for the Storage data flows.
 *
 * Only variable *names* and presence are ever reported. A key, token or password
 * must never be logged, returned in an API response, or embedded in an object
 * path. Callers that need to report configuration state should use
 * `describeStorageConfig`, which returns booleans and names only.
 */

import { DATA_FLOWS_BUCKET } from "./paths";

export interface StorageSettings {
  url: string;
  key: string;
  bucket: string;
}

export interface StorageConfigSummary {
  configured: boolean;
  urlVariable: string | null;
  keyVariable: string | null;
  bucket: string;
  missing: string[];
}

type Env = Record<string, string | undefined>;

function firstNonEmpty(env: Env, names: string[]): { name: string; value: string } | null {
  for (const name of names) {
    const value = (env[name] ?? "").trim();
    if (value) return { name, value };
  }
  return null;
}

/**
 * Read the Supabase URL. `NEXT_PUBLIC_SUPABASE_URL` is the variable the existing
 * workflows already guard; `SUPABASE_URL` is accepted for script-only contexts.
 * The project ref is accepted as a last resort so a CI job that only has the ref
 * can still build the host.
 */
export function resolveSupabaseUrl(env: Env = process.env): { name: string; value: string } | null {
  const direct = firstNonEmpty(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]);
  if (direct) return direct;

  const ref = (env.SUPABASE_PROJECT_REF ?? "").trim();
  if (/^[a-z0-9]{20}$/.test(ref)) {
    return { name: "SUPABASE_PROJECT_REF", value: `https://${ref}.supabase.co` };
  }
  return null;
}

export function resolveReadSettings(env: Env = process.env): StorageSettings | null {
  const url = resolveSupabaseUrl(env);
  const key = firstNonEmpty(env, [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]);
  if (!url || !key) return null;
  return { url: url.value.replace(/\/+$/, ""), key: key.value, bucket: DATA_FLOWS_BUCKET };
}

/** Publishing needs a secret key; a public/anon key must never be used for writes. */
export function resolveWriteSettings(env: Env = process.env): StorageSettings | null {
  const url = resolveSupabaseUrl(env);
  const key = firstNonEmpty(env, ["SUPABASE_SERVICE_ROLE_KEY"]);
  if (!url || !key) return null;
  return { url: url.value.replace(/\/+$/, ""), key: key.value, bucket: DATA_FLOWS_BUCKET };
}

export function describeStorageConfig(
  mode: "read" | "write",
  env: Env = process.env
): StorageConfigSummary {
  const url = resolveSupabaseUrl(env);
  const keyNames =
    mode === "write"
      ? ["SUPABASE_SERVICE_ROLE_KEY"]
      : [
          "SUPABASE_SERVICE_ROLE_KEY",
          "SUPABASE_PUBLISHABLE_KEY",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
          "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        ];
  const key = firstNonEmpty(env, keyNames);

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!key) missing.push(...keyNames);

  return {
    configured: Boolean(url && key),
    urlVariable: url?.name ?? null,
    keyVariable: key?.name ?? null,
    bucket: DATA_FLOWS_BUCKET,
    missing,
  };
}
