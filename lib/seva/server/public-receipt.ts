/**
 * The public receipt reader behind `/r/<token>` (DB §10.3, C-50): the same details as the printed slip - temple,
 * receipt number, seva date, devotee name, gotra and nakshatra (only when the slip prints them), sevas, amounts and
 * payment mode - plus valid or cancelled and the prasadam state. Never the phone number: it is not selected.
 */

import "server-only";
import { NAKSHATRAS } from "@/lib/seva/domain/nakshatras";
import { findOption } from "@/lib/seva/domain/options";
import { isQrToken } from "@/lib/seva/qr";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentMode } from "@/types/seva";
import type { PublicReceipt } from "@/types/seva-receipts";
import { embedded, embeddedLines, int, intOrNull, paise, rowOf, text, textOrNull } from "./read";

const PUBLIC_COLUMNS =
  "receipt_no, seva_date, total, status, prasadam_state, " +
  "seva_orders!inner(devotee_name, gotra, nakshatra_id, nakshatra_text, payment_mode), " +
  "lines:seva_receipt_lines(line_no, seva_name_en, seva_name_kn, quantity, amount)";

function paymentMode(value: unknown): PaymentMode {
  return value === "upi" || value === "online" ? value : "cash";
}

function prasadamState(value: unknown): PublicReceipt["prasadam"] {
  return value === "given" || value === "pending" ? value : "none";
}

/** The receipt with this QR token, or null for anything that is not a known token. */
export async function getPublicReceiptByToken(token: string): Promise<PublicReceipt | null> {
  const value = token.trim();
  if (!isQrToken(value)) return null;

  const db = createAdminClient();
  const [receiptResult, settingsResult] = await Promise.all([
    db.from("seva_receipts").select(PUBLIC_COLUMNS).eq("qr_token", value).maybeSingle(),
    db.from("seva_settings").select("temple_name_en, temple_name_kn, print_gotra, print_nakshatra").eq("id", 1).maybeSingle(),
  ]);
  const row = rowOf(receiptResult);
  if (!row) return null;
  const settings = rowOf(settingsResult);
  const order = embedded(row, "seva_orders");

  const nakshatraId = intOrNull(order, "nakshatra_id");
  const nakshatra = findOption(NAKSHATRAS, nakshatraId)?.en ?? textOrNull(order, "nakshatra_text");

  return {
    templeNameEn: settings ? text(settings, "temple_name_en") : "",
    templeNameKn: settings ? text(settings, "temple_name_kn") : "",
    receiptNo: text(row, "receipt_no"),
    sevaDate: text(row, "seva_date"),
    devoteeName: text(order, "devotee_name"),
    gotra: settings?.print_gotra === true ? textOrNull(order, "gotra") : null,
    nakshatra: settings?.print_nakshatra === true ? nakshatra : null,
    lines: embeddedLines(row, "lines").map((line) => ({
      nameEn: text(line, "seva_name_en"),
      nameKn: textOrNull(line, "seva_name_kn"),
      quantity: int(line, "quantity"),
      amountPaise: paise(line, "amount"),
    })),
    totalPaise: paise(row, "total"),
    mode: paymentMode(order.payment_mode),
    status: row.status === "cancelled" ? "cancelled" : "valid",
    prasadam: prasadamState(row.prasadam_state),
  };
}
