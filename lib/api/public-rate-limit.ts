/**
 * Best-effort rate limiting for the public write endpoints.
 *
 * Built on the site's in-memory limiter (`lib/rate-limit.ts`). It is per server
 * instance, which is the same guarantee the seva routes already rely on: it
 * blunts a burst from one client, it is not a distributed quota. Keys are
 * namespaced under `public:` so they cannot collide with the seva limiter.
 *
 * The caller is identified by the client IP when present. The IP comes from
 * `x-forwarded-for`, which a client can forge; this limiter is therefore a
 * defence-in-depth control behind authentication, not an authorization check.
 * Where the caller is authenticated the routes additionally key on the verified
 * uid, which cannot be forged.
 */

import { rateLimit as siteRateLimit, getClientIP } from "@/lib/rate-limit";

export interface PublicRateLimitOptions {
  /** Namespaced bucket, e.g. `donations:create`. */
  scope: string;
  /** An identity that cannot be forged when available (the verified uid). */
  identity?: string | null;
  limit: number;
  windowMs: number;
}

/** True when the request may proceed; false once the bucket is exhausted. */
export function allowPublicWrite(request: Request, options: PublicRateLimitOptions): boolean {
  const identity = options.identity && options.identity.length > 0 ? options.identity : getClientIP(request);
  return siteRateLimit(`public:${options.scope}:${identity}`, {
    windowMs: options.windowMs,
    maxRequests: options.limit,
  }).success;
}
