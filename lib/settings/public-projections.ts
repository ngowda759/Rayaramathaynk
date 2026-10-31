/**
 * Runtime projections for the public settings endpoint (F-A15.2).
 *
 * `GET /api/public/settings/[key]` serves website settings with the service-role
 * client because `settings_documents` is deny-all under RLS. One of those documents
 * holds more than the public site needs: `financeSettings` carries the billing block
 * (invoice prefix/counter, GSTIN, company contact details), the `billingEnabled`
 * module toggle and inactive special sevas, none of which any public component reads.
 *
 * This helper builds a fresh allow-listed object instead of returning the stored
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
 * Inactive special sevas are filtered out here rather than only on the client, so
 * unpublished sevas never leave the server. Returns `null` when the stored document
 * is missing so the caller keeps its defaults. `billing`, `billingEnabled`,
 * `updatedAt` and any unknown key are deliberately dropped.
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
      ? data.specialSevas
          .filter(isRecord)
          .map(projectSpecialSeva)
          .filter((seva) => seva.isActive)
      : [],
  };
}

/**
 * Apply the per-key public projection. Content documents (`aboutUs`, `footer`, …)
 * are public in full and pass through unchanged; only `financeSettings` is narrowed.
 */
export function projectPublicSettingsDocument(key: string, data: unknown): unknown {
  if (key === "financeSettings") return projectPublicFinanceSettings(data);
  return data;
}
