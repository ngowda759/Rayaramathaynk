/**
 * Escaping helpers for values that are interpolated into a PostgREST filter
 * expression (the string passed to supabase-js `.or()` / `.and()`).
 *
 * `.or()` takes one string, so a caller-supplied term cannot be sent as a bound
 * parameter. PostgREST's filter grammar reserves `,` `.` `:` `(` `)` as structure
 * and treats `\` as an escape character inside a double-quoted value. A term
 * interpolated raw can therefore break the expression or widen the match (e.g. a
 * typed `,` splitting one condition into two).
 *
 * `quoteFilterValue` makes the term inert: it is wrapped in double quotes and any
 * `\` or `"` is escaped, so only the term's own characters are matched. Pair it
 * with `escapeLikePattern` when the operator is `like`/`ilike`, so a literal `%`
 * or `_` also matches itself instead of acting as a wildcard.
 *
 * See PostgREST `ApiRequest.QueryParams` (`pQuotedValue` / `pCharsOrSlashed`).
 */

/** `%`, `_` and `\` typed by a person match themselves in a LIKE/ILIKE pattern. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Quote a value for a PostgREST filter expression, escaping `\` and `"`. The
 * surrounding quotes are what keep reserved characters (`,`, `.`, `(`, `)`)
 * inert.
 */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

/**
 * A `column.ilike.<quoted pattern>` fragment that matches `term` anywhere in the
 * column, safe to drop into an `.or()` expression.
 */
export function ilikeContainsFilter(column: string, term: string): string {
  return `${column}.ilike.${quoteFilterValue(`%${escapeLikePattern(term)}%`)}`;
}
