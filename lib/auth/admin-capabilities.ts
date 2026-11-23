/**
 * Server-side administrative capability enforcement (F-04).
 *
 * The policy lives in `admin-capability-policy.ts` so the admin UI can derive the
 * same map. This module adds the request guard: it verifies the Supabase identity
 * through `verifyAdminUserResult` and checks the stored role's capability.
 */

import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { NextResponse as NextResponseImpl } from "next/server";

import { verifyAdminUserResult, type ServerAdminUser } from "./admin-auth";
import { adminCan, isAdminCapability, type AdminCapability } from "./admin-capability-policy";

export * from "./admin-capability-policy";

export type AdminCapabilityResult =
  | { ok: true; user: ServerAdminUser; capability: AdminCapability }
  | { ok: false; response: NextResponse };

function refusal(message: string, reason: string, status: number, extra?: object): NextResponse {
  return NextResponseImpl.json({ error: message, reason, ...extra }, { status });
}

/**
 * Verify the caller and require one capability. Authentication failures keep the
 * status/reason from `verifyAdminUserResult` (401/403/503); an authenticated
 * caller without the capability gets 403.
 */
export async function requireAdminCapability(
  request: NextRequest,
  capability: AdminCapability,
): Promise<AdminCapabilityResult> {
  return requireAdminCapabilities(request, [capability]);
}

/**
 * Require several capabilities with a single identity verification. Returns the
 * first missing capability on failure.
 */
export async function requireAdminCapabilities(
  request: NextRequest,
  capabilities: readonly AdminCapability[],
): Promise<AdminCapabilityResult> {
  if (capabilities.length === 0 || !capabilities.every(isAdminCapability)) {
    return { ok: false, response: refusal("Unknown capability", "unknown_capability", 403) };
  }

  const result = await verifyAdminUserResult(request);
  if (!result.ok) {
    return {
      ok: false,
      response: refusal(result.message, result.reason, result.status),
    };
  }

  for (const capability of capabilities) {
    if (!adminCan(result.user.role, capability)) {
      return {
        ok: false,
        response: refusal("Forbidden", "insufficient_capability", 403, { capability }),
      };
    }
  }

  return { ok: true, user: result.user, capability: capabilities[0] };
}
