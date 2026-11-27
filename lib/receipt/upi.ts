export const DEFAULT_UPI_PAYEE = "Sri Raghavendra Swamy Matha";

/**
 * Raised when a payment link is requested without a configured UPI id.
 *
 * There is deliberately no built-in VPA: a missing finance setting must fail
 * closed instead of sending money to a hardcoded account.
 */
export class UpiNotConfiguredError extends Error {
  constructor() {
    super("UPI id is not configured. Set it in Admin → Settings → Finance.");
    this.name = "UpiNotConfiguredError";
  }
}

/** Trims a configured UPI id, treating blank values as "not configured". */
export function configuredUpiId(upiId: string | null | undefined): string | null {
  const trimmed = upiId?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Builds a `upi://pay` deep link for the payment QR code. The exact
 * scheme/queries are re-used from the project's existing donation flow, so
 * any UPI app can resolve the QR to a pre-filled payable amount.
 *
 * Throws `UpiNotConfiguredError` when `upiId` is blank so a misconfigured
 * deployment can never produce a payment link.
 */
export function buildUpiPaymentUrl(params: {
  upiId: string;
  payeeName?: string;
  amount: number;
  note?: string;
}): string {
  const upiId = configuredUpiId(params.upiId);
  if (!upiId) throw new UpiNotConfiguredError();

  const payeeName = params.payeeName || DEFAULT_UPI_PAYEE;
  const amount = Number.isFinite(params.amount) && params.amount > 0 ? params.amount : 0;
  const note = params.note?.trim() || "Temple seva receipt";

  const query = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: String(amount),
    cu: "INR",
    tn: note,
  });

  return "upi://pay?" + query.toString();
}

/**
 * Formats an amount for the PDF receipt (standard PDF fonts cannot encode
 * the Indian rupee glyph, so "Rs." is used as the professional equivalent).
 */
export function formatPdfAmount(amount: number): string {
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
  return "Rs. " + formatted;
}
