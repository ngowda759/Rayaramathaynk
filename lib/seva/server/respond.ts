/**
 * JSON answers for the seva routes. Errors go out as `{ error: { code, message, detail? } }` with the code's HTTP
 * status and a plain-English message (lib/seva/errors.ts); never a stack trace or database text. Server logs carry
 * the code and a request id only - never names, phones or error text, which can hold personal data.
 */

import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isSevaErrorCode, SevaError, sevaErrorMessage, sevaErrorStatus } from "@/lib/seva/errors";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function sevaJson<T>(data: T, init?: { status?: number; headers?: Record<string, string> }): NextResponse {
  return NextResponse.json(data, { status: init?.status ?? 200, headers: { ...NO_STORE, ...init?.headers } });
}

export function sevaErrorResponse(err: unknown): NextResponse {
  const known = err instanceof SevaError && isSevaErrorCode(err.code) ? err : null;
  const code = known?.code ?? "internal";
  const status = sevaErrorStatus(code);
  // The detail comes from our own SQL functions or route code and is meant for the client (for example the name in
  // "Paaduka Pooja was switched off" or the steps of a partial failure). An internal error never carries one.
  const detail = code !== "internal" ? known?.detail : undefined;
  const requestId = randomUUID();

  if (status >= 500) {
    const kind = known ? "seva_error" : err instanceof Error ? err.name : typeof err;
    console.error("[seva] request failed:", code, "request", requestId, "kind", kind);
  }

  const body = { error: { code, message: sevaErrorMessage(code, detail), ...(detail ? { detail } : {}) } };
  return NextResponse.json(body, { status, headers: { ...NO_STORE, "x-request-id": requestId } });
}
