/**
 * The registered counter PC check (C-37, DB §8.4). A counter call carries `x-seva-device: <device id>.<secret>`;
 * the server keeps only the SHA-256 of the secret in `counter_devices.secret_hash` and compares in constant time.
 * The header and the secret are never logged.
 */

import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { SevaError } from "@/lib/seva/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const DEVICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
/** The browser sends 32 random bytes as base64url (43 characters); anything far longer is not ours. */
const MAX_SECRET_LENGTH = 256;

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function sameHash(a: string, b: string): boolean {
  if (!HASH.test(a) || !HASH.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

function parseHeader(header: string): { id: string; secret: string } | null {
  const dot = header.indexOf(".");
  if (dot <= 0) return null;
  const id = header.slice(0, dot).trim().toLowerCase();
  const secret = header.slice(dot + 1).trim();
  if (!DEVICE_ID.test(id) || secret.length === 0 || secret.length > MAX_SECRET_LENGTH) return null;
  return { id, secret };
}

/** A counter PC whose header checked out. `retired` is set only when the caller allowed a retired PC and it is one. */
export interface VerifiedDevice {
  id: string;
  counterId: number;
  retired?: true;
}

/**
 * The live device named by the header, or null when the header is missing, malformed, names an unknown or retired
 * device, or carries the wrong secret. With `allowRetired` a retired device with the right secret is answered too,
 * marked `retired: true` - only the outbox sync asks for that (DB 8.4: its late uploads, inside its gap). Throws
 * SevaError('internal') when the database cannot be read.
 */
export async function verifyDeviceHeader(
  header: string | null,
  opts: { allowRetired?: boolean } = {},
): Promise<VerifiedDevice | null> {
  if (!header) return null;
  const parsed = parseHeader(header);
  if (!parsed) return null;

  const { data, error } = await createAdminClient()
    .from("counter_devices")
    .select("id, counter_id, secret_hash, retired_at")
    .eq("id", parsed.id)
    .maybeSingle();
  if (error) throw new SevaError("internal");
  if (!data) return null;

  const row = data as { id: unknown; counter_id: unknown; secret_hash: unknown; retired_at: unknown };
  const retired = row.retired_at !== null;
  if (retired && opts.allowRetired !== true) return null;
  if (typeof row.secret_hash !== "string" || !sameHash(sha256Hex(parsed.secret), row.secret_hash)) return null;
  if (typeof row.id !== "string" || typeof row.counter_id !== "number") throw new SevaError("internal");
  return retired ? { id: row.id, counterId: row.counter_id, retired: true } : { id: row.id, counterId: row.counter_id };
}
