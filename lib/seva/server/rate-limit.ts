/**
 * Best-effort rate limit for seva routes, per server instance (DB §15.1: `/r/<token>` per IP, devotee orders per
 * account). Built on the site's in-memory limiter (lib/rate-limit.ts); keys are kept apart under `seva:`.
 */

import "server-only";
import { rateLimit as siteRateLimit } from "@/lib/rate-limit";

/** True when the call may go ahead; false once `limit` calls were made inside `windowMs`. */
export function rateLimit(key: string, opts: { limit: number; windowMs: number }): boolean {
  return siteRateLimit(`seva:${key}`, { windowMs: opts.windowMs, maxRequests: opts.limit }).success;
}
