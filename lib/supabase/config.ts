/**
 * Status of the *public* Supabase configuration (URL + anon key).
 *
 * `lib/supabase/client.ts` substitutes a placeholder URL/key when the public
 * environment variables are absent, so a build without them still compiles.
 * That substitution is invisible at the call site: `signInWithPassword` then
 * fails at the network layer and every auth screen reports the failure as
 * "invalid credentials", which blames the person's password for a deployment
 * problem. This module lets the auth screens tell the two apart.
 *
 * Only the two variables that are already shipped to the browser are read here;
 * no secret (service-role key, password, token) is read or returned. The status
 * carries variable *names* and a parsed origin, never variable values.
 */

export const SUPABASE_PUBLIC_ENV_KEYS = {
  url: "NEXT_PUBLIC_SUPABASE_URL",
  anonKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  publishableKey: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
} as const;

/** The values `lib/supabase/client.ts` substitutes when the variables are absent. */
export const SUPABASE_PLACEHOLDER_URL = "https://placeholder.supabase.co";
export const SUPABASE_PLACEHOLDER_KEY = "placeholder";

/**
 * Resolve the browser-safe Supabase API key from either supported variable name.
 * Supabase renamed the "anon" key to "publishable" key (`sb_publishable_...`);
 * both are the same public, RLS-restricted credential, so accept either and
 * prefer the legacy name when both are set.
 */
export function resolveSupabasePublicKey(env: SupabasePublicEnv): string {
  const anon = (env.anonKey ?? "").trim();
  if (anon) return anon;
  return (env.publishableKey ?? "").trim();
}

export interface SupabaseConfigStatus {
  /** True only when a real URL and key are present and the URL is a valid http(s) origin. */
  isConfigured: boolean;
  /** True when a variable is absent or is still the built-in placeholder. */
  usingPlaceholder: boolean;
  /** Names of the missing or invalid variables (never their values). */
  missing: string[];
  /** Parsed URL origin, or `null` when absent/invalid. Safe to display. */
  url: string | null;
}

export interface SupabasePublicEnv {
  url?: string | null;
  anonKey?: string | null;
  publishableKey?: string | null;
}

function isPlaceholderUrl(url: string): boolean {
  return url === SUPABASE_PLACEHOLDER_URL || url.includes("placeholder.supabase.co");
}

/** Pure validation, so the rules can be unit-tested without touching the environment. */
export function validateSupabasePublicConfig(env: SupabasePublicEnv): SupabaseConfigStatus {
  const url = (env.url ?? "").trim();
  const anonKey = resolveSupabasePublicKey(env);
  const missing: string[] = [];
  let origin: string | null = null;
  let usingPlaceholder = false;

  if (!url) {
    missing.push(SUPABASE_PUBLIC_ENV_KEYS.url);
  } else if (isPlaceholderUrl(url)) {
    missing.push(SUPABASE_PUBLIC_ENV_KEYS.url);
    usingPlaceholder = true;
  } else {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        missing.push(SUPABASE_PUBLIC_ENV_KEYS.url);
      } else {
        origin = parsed.origin;
      }
    } catch {
      missing.push(SUPABASE_PUBLIC_ENV_KEYS.url);
    }
  }

  if (!anonKey) {
    missing.push(SUPABASE_PUBLIC_ENV_KEYS.anonKey);
  } else if (anonKey === SUPABASE_PLACEHOLDER_KEY) {
    missing.push(SUPABASE_PUBLIC_ENV_KEYS.anonKey);
    usingPlaceholder = true;
  }

  return {
    isConfigured: missing.length === 0,
    usingPlaceholder,
    missing,
    url: origin,
  };
}

/**
 * Read the live environment. `process.env.NEXT_PUBLIC_*` is replaced at build
 * time, so the properties must be accessed literally (not destructured).
 */
export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  return validateSupabasePublicConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

/** A configuration message that names the missing variables and never a value. */
export function supabaseConfigMessage(status: SupabaseConfigStatus): string {
  return (
    "Supabase authentication is not configured in this deployment " +
    `(missing: ${status.missing.join(", ")}). ` +
    "An administrator must set the Supabase environment variables."
  );
}
