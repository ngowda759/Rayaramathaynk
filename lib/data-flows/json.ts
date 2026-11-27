/** JSON helpers shared by the Storage readers, publishers and verification steps. */

export function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "invalid JSON" };
  }
}

/**
 * Deterministic serialisation used only for equality checks, so key order in a
 * freshly serialised object cannot make a successful read-back look different.
 *
 * Follows JSON semantics, because it is compared against `JSON.parse` output:
 * `JSON.stringify` drops object keys whose value is `undefined` and turns an
 * `undefined` array entry into `null`. Rendering those as the literal
 * `undefined` made every payload carrying an optional-but-unset field fail its
 * own read-back verification.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : stableStringify(item))).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function jsonEqual(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}
