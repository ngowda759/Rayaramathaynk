/**
 * Client-safe administrative capability policy (F-04).
 *
 * This module deliberately has no `server-only` or `next/server` imports so the
 * admin UI can derive the same role -> capability map the API enforces. The
 * browser only uses it to hide or show navigation; every authorization decision
 * is still made on the server by `lib/auth/admin-capabilities.ts`.
 */

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

export interface AdminPermissionFlags {
  canAccessAdmin: boolean;
  canAccessSettings: boolean;
  canAccessFinance: boolean;
  canManageUsers: boolean;
  canAccessBilling: boolean;
  canAccessAdministration: boolean;
}

/** UI-only permission flags, derived from the same map the API uses. */
export function deriveAdminPermissions(role: unknown): AdminPermissionFlags {
  const can = (capability: AdminCapability) => adminCan(role, capability);
  return {
    canAccessAdmin: isAdminConsoleRole(role),
    canAccessSettings: can("settings.general.read"),
    canAccessFinance: can("settings.finance.read"),
    canManageUsers: can("users.create"),
    canAccessBilling: can("settings.finance.read"),
    canAccessAdministration: can("administration.revalidate"),
  };
}
