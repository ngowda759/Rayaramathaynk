/**
 * Runtime projections for the public settings endpoint (F-A15.2).
 *
 * `GET /api/public/settings/[key]` serves website settings with the service-role
 * client because `settings_documents` is deny-all under RLS. Two of those
 * documents hold more than the public site needs:
 *
 *   * `financeSettings` carries the billing block (invoice prefix/counter, GSTIN,
 *     company contact details) and the `billingEnabled` module toggle, none of
 *     which any public component reads;
 *   * `device` carries notification, calendar, share-template and QR-scanner
 *     defaults that only the (never-invoked) device settings singleton reads.
 *
 * These helpers build a fresh allow-listed object instead of returning the stored
 * document, so an unknown or newly-added internal field can never leak by default.
 * Every value is validated at runtime (not with a TypeScript assertion), and nested
 * objects are only read when they are actually plain objects.
 */

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** The finance fields the public donation form renders. */
export interface PublicFinanceSettings {
  enabled: boolean;
  upi: { enabled: boolean; id: string; displayName: string };
  bankTransfer: {
    enabled: boolean;
    accountName: string;
    accountNumber: string;
    bankName: string;
    ifscCode: string;
    branch: string;
  };
  specialSevas: Array<{
    id: string;
    title: string;
    description: string;
    amount: number;
    icon: string;
    isActive: boolean;
    order: number;
  }>;
}

/** The device fields the public map consumes. */
export interface PublicDeviceSettings {
  templeLocation?: {
    latitude: number;
    longitude: number;
    name: string;
    address: string;
    phone: string;
  };
}

function projectSpecialSeva(value: unknown): PublicFinanceSettings["specialSevas"][number] {
  const seva = isRecord(value) ? value : {};
  return {
    id: asString(seva.id),
    title: asString(seva.title),
    description: asString(seva.description),
    amount: asNumber(seva.amount),
    icon: asString(seva.icon),
    isActive: asBoolean(seva.isActive),
    order: asNumber(seva.order),
  };
}

/**
 * Public projection of the `financeSettings` document: only the donation fields.
 * Returns `null` when the stored document is missing so the caller keeps its
 * defaults. `billing`, `billingEnabled`, `updatedAt` and any unknown key are
 * deliberately dropped.
 */
export function projectPublicFinanceSettings(data: unknown): PublicFinanceSettings | null {
  if (!isRecord(data)) return null;

  const upi = isRecord(data.upi) ? data.upi : {};
  const bank = isRecord(data.bankTransfer) ? data.bankTransfer : {};

  return {
    enabled: asBoolean(data.enabled, true),
    upi: {
      enabled: asBoolean(upi.enabled),
      id: asString(upi.id),
      displayName: asString(upi.displayName),
    },
    bankTransfer: {
      enabled: asBoolean(bank.enabled),
      accountName: asString(bank.accountName),
      accountNumber: asString(bank.accountNumber),
      bankName: asString(bank.bankName),
      ifscCode: asString(bank.ifscCode),
      branch: asString(bank.branch),
    },
    specialSevas: Array.isArray(data.specialSevas)
      ? data.specialSevas.filter(isRecord).map(projectSpecialSeva)
      : [],
  };
}

/**
 * Public projection of the `device` document: only the temple location. When the
 * stored document has no usable location the key is omitted entirely, so the
 * caller's shallow merge keeps its default location. Notification, calendar,
 * share-template and QR-scanner defaults are dropped.
 */
export function projectPublicDeviceSettings(data: unknown): PublicDeviceSettings | null {
  if (!isRecord(data)) return null;

  const out: PublicDeviceSettings = {};
  if (isRecord(data.templeLocation)) {
    const loc = data.templeLocation;
    out.templeLocation = {
      latitude: asNumber(loc.latitude),
      longitude: asNumber(loc.longitude),
      name: asString(loc.name),
      address: asString(loc.address),
      phone: asString(loc.phone),
    };
  }
  return out;
}

/**
 * Apply the per-key public projection. Content documents (`aboutUs`, `footer`, …)
 * are public in full and pass through unchanged; only the two over-exposing keys
 * are narrowed.
 */
export function projectPublicSettingsDocument(key: string, data: unknown): unknown {
  if (key === "financeSettings") return projectPublicFinanceSettings(data);
  if (key === "device") return projectPublicDeviceSettings(data);
  return data;
}
