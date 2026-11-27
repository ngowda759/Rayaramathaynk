/**
 * A small, typed Supabase Storage object client.
 *
 * Storage is addressed over the REST object API rather than the Postgres client:
 * these reads and writes never touch a database table, and keeping the adapter
 * free of `@supabase/supabase-js` means a workflow script that publishes objects
 * cannot be mistaken for a database writer by the repository's writer inventory.
 *
 * The adapter is server-only. The factory refuses to run in a browser, and the
 * key is never placed in a path, a log line or an error message.
 */

import type { StorageSettings } from "./config";

export interface StorageGetResult {
  ok: boolean;
  text: string | null;
  status: number;
  error?: string;
}

export interface StoragePutResult {
  ok: boolean;
  status: number;
  error?: string;
}

export interface StorageListEntry {
  name: string;
  id: string | null;
}

export interface StorageListResult {
  ok: boolean;
  entries: StorageListEntry[];
  status: number;
  error?: string;
}

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    cache?: "no-store";
  }
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}>;

export interface StorageGetOptions {
  /**
   * Ask for the object as it is now, not as any cache remembers it: unique query
   * parameter plus no-cache request headers. Verification reads run moments after
   * a write, where a cached or not-yet-propagated previous version would make a
   * successful upload look like a mismatch.
   */
  fresh?: boolean;
}

export interface ObjectStorage {
  readonly bucket: string;
  getText(path: string, options?: StorageGetOptions): Promise<StorageGetResult>;
  putText(path: string, text: string): Promise<StoragePutResult>;
  list(prefix: string, limit?: number): Promise<StorageListResult>;
}

let freshReadSequence = 0;

function encodeObjectPath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function storageUrl(config: StorageSettings, suffix: string): string {
  return `${config.url.replace(/\/+$/, "")}/storage/v1/${suffix}`;
}

function authHeaders(config: StorageSettings): Record<string, string> {
  return {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
  };
}

function describeFailure(status: number, body: string): string {
  let detail = "";
  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: unknown };
    const candidate =
      typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.error === "string"
          ? parsed.error
          : "";
    detail = candidate.slice(0, 200);
  } catch {
    detail = "";
  }
  return detail
    ? `Storage request failed with HTTP ${status}: ${detail}`
    : `Storage request failed with HTTP ${status}`;
}

export function createSupabaseStorage(
  config: StorageSettings,
  fetchImpl: FetchLike = fetch as unknown as FetchLike
): ObjectStorage {
  if (typeof window !== "undefined") {
    throw new Error(
      "The Supabase Storage data-flow client is server-only and must never run in a browser."
    );
  }

  const objectBase = storageUrl(config, `object/${encodeURIComponent(config.bucket)}`);
  const listBase = storageUrl(config, `object/list/${encodeURIComponent(config.bucket)}`);

  return {
    bucket: config.bucket,

    async getText(path: string, options: StorageGetOptions = {}): Promise<StorageGetResult> {
      const target = options.fresh
        ? `${objectBase}/${encodeObjectPath(path)}?t=${Date.now()}-${++freshReadSequence}`
        : `${objectBase}/${encodeObjectPath(path)}`;
      const headers = options.fresh
        ? {
            ...authHeaders(config),
            "Cache-Control": "no-cache, no-store, max-age=0",
            Pragma: "no-cache",
          }
        : authHeaders(config);

      let response: Awaited<ReturnType<FetchLike>>;
      try {
        response = await fetchImpl(target, {
          method: "GET",
          headers,
          cache: "no-store",
        });
      } catch (error) {
        return {
          ok: false,
          text: null,
          status: 0,
          error: `Storage request failed: ${error instanceof Error ? error.message : "network error"}`,
        };
      }

      const body = await response.text();
      if (!response.ok) {
        return {
          ok: false,
          text: null,
          status: response.status,
          error: describeFailure(response.status, body),
        };
      }
      return { ok: true, text: body, status: response.status };
    },

    async putText(path: string, text: string): Promise<StoragePutResult> {
      let response: Awaited<ReturnType<FetchLike>>;
      try {
        response = await fetchImpl(`${objectBase}/${encodeObjectPath(path)}`, {
          method: "POST",
          headers: {
            ...authHeaders(config),
            "Content-Type": "application/json; charset=utf-8",
            "x-upsert": "true",
            "cache-control": "no-cache",
          },
          body: text,
        });
      } catch (error) {
        return {
          ok: false,
          status: 0,
          error: `Storage upload failed: ${error instanceof Error ? error.message : "network error"}`,
        };
      }

      if (response.ok) return { ok: true, status: response.status };
      const body = await response.text();
      return {
        ok: false,
        status: response.status,
        error: describeFailure(response.status, body),
      };
    },

    async list(prefix: string, limit = 100): Promise<StorageListResult> {
      let response: Awaited<ReturnType<FetchLike>>;
      try {
        response = await fetchImpl(listBase, {
          method: "POST",
          headers: {
            ...authHeaders(config),
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify({
            prefix,
            limit,
            offset: 0,
            sortBy: { column: "name", order: "asc" },
          }),
        });
      } catch (error) {
        return {
          ok: false,
          entries: [],
          status: 0,
          error: `Storage list failed: ${error instanceof Error ? error.message : "network error"}`,
        };
      }

      const body = await response.text();
      if (!response.ok) {
        return {
          ok: false,
          entries: [],
          status: response.status,
          error: describeFailure(response.status, body),
        };
      }

      try {
        const parsed = JSON.parse(body) as unknown;
        const entries = Array.isArray(parsed)
          ? parsed
              .filter(
                (entry): entry is { name: string; id?: string | null } =>
                  typeof entry === "object" &&
                  entry !== null &&
                  typeof (entry as { name?: unknown }).name === "string"
              )
              .map((entry) => ({ name: entry.name, id: entry.id ?? null }))
          : [];
        return { ok: true, entries, status: response.status };
      } catch {
        return {
          ok: false,
          entries: [],
          status: response.status,
          error: "Storage list returned a non-JSON body",
        };
      }
    },
  };
}

/** True when a failed read means "the object does not exist". */
export function isStorageNotFound(result: StorageGetResult): boolean {
  return !result.ok && (result.status === 400 || result.status === 404);
}
