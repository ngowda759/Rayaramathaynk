/**
 * Server-side administrative capabilities (F-04).
 *
 * The legacy admin console and the Raya AI admin API used one coarse allow-list
 * (`ADMIN_CONSOLE_ROLES`) for every operation. This module defines the exact
 * operation a route needs and the roles allowed to perform it. The identity and
 * role are always the ones `verifyAdminUserResult` resolves from `public.users`
 * by `auth_user_id`; a caller-supplied role or identity is never consulted.
 *
 * Seva operations are intentionally absent: `/api/seva/**` keeps its own
 * operation-level matrix in `lib/seva/permissions.ts`.
 */

import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { NextResponse as NextResponseImpl } from "next/server";

import { verifyAdminUserResult, type ServerAdminUser } from "./admin-auth";

export type AdminConsoleRole =
  | "super_admin"
  | "temple_admin"
  | "admin"
  | "billing"
  | "priest"
  | "staff"
  | "office_staff";

export const ADMIN_CAPABILITIES = [
  "users.directory.read",
  "users.create",
  "users.role.assign",
  "users.delete",
  "settings.general.read",
  "settings.general.write",
  "settings.finance.read",
  "settings.finance.write",
  "settings.device.write",
  "donations.read",
  "donations.update",
  "donations.delete",
  "members.read",
  "members.write",
  "members.delete",
  "volunteers.read",
  "volunteers.write",
  "volunteers.delete",
  "bookings.read",
  "analytics.read",
  "analytics.write",
  "dashboard.read",
  "content.read",
  "content.write",
  "chat_training.read",
  "chat_training.write",
  "homepage.read",
  "homepage.write",
  "featured.read",
  "featured.write",
  "featured.delete",
  "quotes.read",
  "quotes.write",
  "quotes.delete",
  "testimonials.read",
  "testimonials.write",
  "testimonials.delete",
  "temple_areas.read",
  "temple_areas.write",
  "temple_areas.delete",
  "aaradhane.read",
  "aaradhane.write",
  "aaradhane.delete",
  "events.read",
  "events.write",
  "events.delete",
  "announcements.read",
  "announcements.write",
  "announcements.delete",
  "gallery.read",
  "gallery.write",
  "gallery.delete",
  "knowledge.read",
  "knowledge.write",
  "knowledge.delete",
  "knowledge.approve",
  "knowledge.publish",
  "ai.settings.read",
  "ai.settings.write",
  "ai.knowledge.import",
  "ai.analytics.read",
  "ai.chat_moderation",
  "reports.read",
  "reports.write",
  "administration.revalidate",
  "administration.seed_ai_settings",
] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

const CAPABILITY_SET: ReadonlySet<string> = new Set(ADMIN_CAPABILITIES);

/** Read-only content/analytics capabilities shared by the roles that may view. */
const CONTENT_READ: readonly AdminCapability[] = [
  "users.directory.read",
  "bookings.read",
  "analytics.read",
  "analytics.write",
  "dashboard.read",
  "content.read",
  "homepage.read",
  "featured.read",
  "quotes.read",
  "testimonials.read",
  "temple_areas.read",
  "aaradhane.read",
  "events.read",
  "announcements.read",
  "gallery.read",
  "knowledge.read",
  "reports.read",
];

const PRIEST: readonly AdminCapability[] = [
  ...CONTENT_READ,
  "settings.general.read",
  "settings.finance.read",
  "donations.read",
  "members.read",
  "volunteers.read",
  "ai.settings.read",
  "ai.analytics.read",
  "events.write",
];

const STAFF: readonly AdminCapability[] = [
  ...CONTENT_READ,
  "donations.read",
  "members.read",
  "volunteers.read",
  "events.write",
];

const BILLING: readonly AdminCapability[] = [
  "donations.read",
  "settings.finance.read",
  "analytics.read",
  "analytics.write",
  "dashboard.read",
];

const OFFICE_STAFF: readonly AdminCapability[] = [];

/**
 * Super-admin-only operations: the counter's UPI payee, device security,
 * deletion of money/people records, and user deletion.
 */
const SUPER_ADMIN_ONLY: ReadonlySet<AdminCapability> = new Set<AdminCapability>([
  "settings.finance.write",
  "settings.device.write",
  "donations.delete",
  "members.delete",
  "volunteers.delete",
  "users.delete",
]);

const TEMPLE_ADMIN: readonly AdminCapability[] = ADMIN_CAPABILITIES.filter(
  (capability) => !SUPER_ADMIN_ONLY.has(capability),
);

const ROLE_CAPABILITIES: Record<AdminConsoleRole, ReadonlySet<AdminCapability>> = {
  super_admin: new Set(ADMIN_CAPABILITIES),
  temple_admin: new Set(TEMPLE_ADMIN),
  // Legacy alias: the seva matrix already maps `admin` to `temple_admin`.
  admin: new Set(TEMPLE_ADMIN),
  billing: new Set(BILLING),
  priest: new Set(PRIEST),
  staff: new Set(STAFF),
  office_staff: new Set(OFFICE_STAFF),
};

function normalizeRole(role: unknown): string {
  if (typeof role !== "string") return "";
  return role.trim().toLowerCase().replace(/\s+/g, "_");
}

export function isAdminConsoleRole(role: unknown): role is AdminConsoleRole {
  return Object.prototype.hasOwnProperty.call(ROLE_CAPABILITIES, normalizeRole(role));
}

export function isAdminCapability(capability: unknown): capability is AdminCapability {
  return typeof capability === "string" && CAPABILITY_SET.has(capability);
}

/** True when the stored role may perform the capability. Unknown roles deny. */
export function adminCan(role: unknown, capability: AdminCapability): boolean {
  const normalized = normalizeRole(role);
  if (!Object.prototype.hasOwnProperty.call(ROLE_CAPABILITIES, normalized)) return false;
  return ROLE_CAPABILITIES[normalized as AdminConsoleRole].has(capability);
}

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
