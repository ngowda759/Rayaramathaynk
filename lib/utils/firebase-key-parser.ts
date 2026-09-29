/**
 * Safely parses and normalizes a Firebase private key string.
 * Handles various formatting issues common with environment variables and CI/CD secrets:
 * - Literal '\n' characters (escaped newlines)
 * - CRLF ('\r\n') line endings
 * - Surrounding quotes (single or double)
 * - Extraneous whitespace
 *
 * @param key The raw private key string
 * @returns A normalized PEM formatted private key string
 */
export function parseFirebasePrivateKey(key: string | undefined | null): string {
  if (!key) {
    return "";
  }

  let normalized = key.trim();

  // Remove surrounding quotes if present (single or double)
  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    normalized = normalized.slice(1, -1).trim();
  } else if (normalized.startsWith("'") && normalized.endsWith("'")) {
    normalized = normalized.slice(1, -1).trim();
  }

  // Replace escaped newlines with actual newlines
  normalized = normalized.replace(/\\n/g, '\n');

  // Replace CRLF with standard LF
  normalized = normalized.replace(/\r\n/g, '\n');

  // Also replace literal \r if any exist without \n
  normalized = normalized.replace(/\\r/g, '');

  // Clean up any double newlines that might have been introduced
  // although standard PEM won't have double newlines, let's keep it safe.
  // Actually, replacing \n+ with \n might be safer, but let's just do standard normalization.

  return normalized;
}
