import { z } from "zod";

/**
 * The exact code points removed by ECMAScript `String.prototype.trim()`.
 *
 * Kept as a list so the PostgreSQL index expression can be generated from it and
 * tested against the runtime's `trim()` behaviour. Do not add or remove entries
 * without changing the migration expression in the same commit.
 */
export const EMAIL_TRIM_WHITESPACE_CODEPOINTS = [
  0x0009, // TAB
  0x000a, // LINE FEED
  0x000b, // VERTICAL TAB
  0x000c, // FORM FEED
  0x000d, // CARRIAGE RETURN
  0x0020, // SPACE
  0x00a0, // NO-BREAK SPACE
  0x1680, // OGHAM SPACE MARK
  0x2000, // EN QUAD
  0x2001, // EM QUAD
  0x2002, // EN SPACE
  0x2003, // EM SPACE
  0x2004, // THREE-PER-EM SPACE
  0x2005, // FOUR-PER-EM SPACE
  0x2006, // SIX-PER-EM SPACE
  0x2007, // FIGURE SPACE
  0x2008, // PUNCTUATION SPACE
  0x2009, // THIN SPACE
  0x200a, // HAIR SPACE
  0x2028, // LINE SEPARATOR
  0x2029, // PARAGRAPH SEPARATOR
  0x202f, // NARROW NO-BREAK SPACE
  0x205f, // MEDIUM MATHEMATICAL SPACE
  0x3000, // IDEOGRAPHIC SPACE
  0xfeff, // ZERO WIDTH NO-BREAK SPACE (BOM)
] as const;

const WHITESPACE_CLASS = EMAIL_TRIM_WHITESPACE_CODEPOINTS.map(
  (cp) => `\\u{${cp.toString(16).toUpperCase().padStart(4, "0")}}`,
).join("");
const ANY_WHITESPACE = new RegExp(`[${WHITESPACE_CLASS}]`, "u");

/** The body of a PostgreSQL `U&'...'` literal for the same code-point set. */
export const EMAIL_WHITESPACE_SQL_U_STRING = EMAIL_TRIM_WHITESPACE_CODEPOINTS.map(
  (cp) => `\\${cp.toString(16).toUpperCase().padStart(4, "0")}`,
).join("");

/**
 * The only expression the `users_email_lower_btrim_key` index may use.
 *
 * `btrim(email, <ECMAScript whitespace set>)` removes exactly the code points that
 * JavaScript `trim()` removes, and `translate` folds only ASCII A-Z. PostgreSQL
 * `lower()` is collation-dependent, so it is deliberately not used here.
 */
export const USERS_EMAIL_CANONICAL_SQL_EXPRESSION =
  `translate(btrim(email, U&'${EMAIL_WHITESPACE_SQL_U_STRING}'), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')`;

export type EmailNormalizationFailure = "empty" | "internal-whitespace";

export class EmailNormalizationError extends Error {
  constructor(public readonly reason: Exclude<EmailNormalizationFailure, "empty">) {
    super("Email contains whitespace inside the address");
    this.name = "EmailNormalizationError";
  }
}

/**
 * Canonical email form:
 *   1. remove every ECMAScript `trim()` whitespace code point from both ends;
 *   2. reject whitespace that remains inside the address;
 *   3. fold ASCII A-Z to a-z and preserve every other character.
 *
 * Step 3 is intentionally ASCII-only: the PostgreSQL expression uses `translate`,
 * not the collation-dependent `lower()`. Non-ASCII case is outside the contract.
 */
export function normalizeEmailAddress(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (ANY_WHITESPACE.test(trimmed)) {
    throw new EmailNormalizationError("internal-whitespace");
  }
  return trimmed.replace(/[A-Z]/g, (char) => char.toLowerCase());
}

export function tryNormalizeEmailAddress(
  raw: string | null | undefined,
): { ok: true; email: string } | { ok: false; reason: EmailNormalizationFailure } {
  let email: string;
  try {
    email = normalizeEmailAddress(raw);
  } catch (error) {
    if (error instanceof EmailNormalizationError) {
      return { ok: false, reason: error.reason };
    }
    throw error;
  }
  if (!email) return { ok: false, reason: "empty" };
  return { ok: true, email };
}

/** Zod schema for an address that must already be in the canonical contract. */
export function normalizedEmailSchema(message = "Invalid email format") {
  return z
    .string()
    .transform((raw, ctx) => {
      const result = tryNormalizeEmailAddress(raw);
      if (!result.ok) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return result.email;
    })
    .pipe(z.email(message));
}
