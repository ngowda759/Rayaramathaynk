/**
 * Calls one seva SQL function through the service-role client (DB §7.8). Business errors raised as
 * `RAISE EXCEPTION 'SEVA:<code>' USING DETAIL = '<json>'` become SevaError(code, detail); anything else becomes
 * SevaError('internal') and only the Postgres error code is logged - database text can hold personal data.
 */

import "server-only";
import { isSevaErrorCode, SevaError } from "@/lib/seva/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const SEVA_FUNCTION = /^seva_[a-z0-9_]+$/;
const BUSINESS_ERROR = /^SEVA:([a-z_]+)$/;

interface PostgrestErrorLike {
  message?: unknown;
  details?: unknown;
  code?: unknown;
}

function parseDetail(details: unknown): Record<string, unknown> | undefined {
  if (typeof details !== "string" || details.trim() === "") return undefined;
  try {
    const parsed: unknown = JSON.parse(details);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function toSevaError(fn: string, error: PostgrestErrorLike): SevaError {
  const match = typeof error.message === "string" ? BUSINESS_ERROR.exec(error.message.trim()) : null;
  if (match && isSevaErrorCode(match[1])) return new SevaError(match[1], parseDetail(error.details));
  console.error("[seva rpc]", fn, "failed with database code", typeof error.code === "string" ? error.code : "none");
  return new SevaError("internal");
}

export async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!SEVA_FUNCTION.test(fn)) throw new Error("callRpc only calls seva_* SQL functions.");

  let result: { data: unknown; error: PostgrestErrorLike | null };
  try {
    result = await createAdminClient().rpc(fn, args);
  } catch (error) {
    console.error("[seva rpc]", fn, "could not reach the database:", error instanceof Error ? error.name : typeof error);
    throw new SevaError("internal");
  }
  if (result.error) throw toSevaError(fn, result.error);
  return result.data as T;
}
