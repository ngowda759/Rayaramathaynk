/**
 * The counter's UPI payee (DB §7.2 note under seva_settings): read from the site's existing finance settings in
 * Firestore (`settings/financeSettings`, the document behind hooks/useFinanceSettings.ts) and never defaulted. No UPI
 * id, or UPI switched off, means the counter offers cash only (17.4: no hard-coded VPA).
 *
 * Firestore stays the source, but every read is compared with the last payee recorded in Supabase
 * (`seva_note_counter_upi`), so a change made there is audited as `settings.upi_changed` and raised in Needs attention
 * (A3 security gate H-1). A read that cannot be recorded is not used.
 */

import "server-only";
import { SevaError } from "@/lib/seva/errors";
import { callRpc } from "./rpc";

const SETTINGS_COLLECTION = "settings";
const FINANCE_DOC = "financeSettings";
/** handle@psp: letters, digits, dots, hyphens and underscores, then the provider's handle. */
const VPA = /^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$/;
const MAX_PAYEE_NAME = 100;

type CounterUpi = { vpa: string; payeeName: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The payee in the finance settings document, or null when UPI is off, the id is empty or is not a UPI id. */
function upiOf(data: Record<string, unknown> | undefined): CounterUpi | null {
  const upi = data?.upi;
  if (upi === null || typeof upi !== "object") return null;
  const { enabled, id, displayName } = upi as Record<string, unknown>;
  if (enabled === false) return null;
  const vpa = text(id);
  if (!VPA.test(vpa)) return null;
  const payeeName = text(displayName).slice(0, MAX_PAYEE_NAME);
  return { vpa, payeeName: payeeName || vpa };
}

/**
 * The UPI id and payee name the counter shows on its payment QR, or null when UPI is switched off, the id is empty or
 * is not a UPI id. A missing `enabled` flag counts as on, as the finance settings page treats it. Throws
 * SevaError('internal') when Firestore cannot be read, and the SQL function's error when the payee cannot be recorded.
 */
export async function readCounterUpi(): Promise<CounterUpi | null> {
  let data: Record<string, unknown> | undefined;
  try {
    // Firebase Admin loads on first use, as in identity-firebase.ts.
    const { getAdminFirestore } = await import("@/lib/admin-firebase");
    const db = await getAdminFirestore();
    const snapshot = await db.collection(SETTINGS_COLLECTION).doc(FINANCE_DOC).get();
    data = snapshot.exists ? (snapshot.data() as Record<string, unknown> | undefined) : undefined;
  } catch {
    throw new SevaError("internal");
  }

  const upi = upiOf(data);
  await callRpc<unknown>("seva_note_counter_upi", { p_vpa: upi?.vpa ?? null, p_payee_name: upi?.payeeName ?? null });
  return upi;
}
