/**
 * Server-side request-body validation for API route handlers.
 *
 * Every public write route parses its JSON body through a Zod schema before the
 * service layer sees it, so an unvalidated or partially-typed body can never reach
 * a database write. The failure response is deliberately uniform: a 400 with a
 * per-field message list, never the raw body, the schema or a stack trace.
 *
 * The schema strips keys it does not declare, which is what stops a caller from
 * setting fields the route did not intend to accept (mass assignment).
 */

import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/** A 400 whose `details` name only the offending fields and their schema messages. */
export function invalidBody(error: { issues: { path: PropertyKey[]; message: string }[] }): NextResponse {
  return NextResponse.json(
    {
      error: "Invalid request body",
      details: error.issues.map((issue) => ({
        field: issue.path.join(".") || "(body)",
        message: issue.message,
      })),
    },
    { status: 400 }
  );
}

/** Parse an already-decoded value against a schema. */
export function validateBody<T>(raw: unknown, schema: ZodType<T>): ValidationResult<T> {
  const result = schema.safeParse(raw);
  if (!result.success) return { ok: false, response: invalidBody(result.error) };
  return { ok: true, data: result.data };
}

/**
 * Read and parse a JSON request body against a schema. A body that is not valid
 * JSON is a 400 too, never a 500.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<ValidationResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }),
    };
  }
  return validateBody(raw, schema);
}
