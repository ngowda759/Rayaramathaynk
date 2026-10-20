/**
 * Money helpers for the seva module. Every amount is held as an integer number of paise;
 * rupee strings exist only at the edges (forms, SQL numeric, the printed slip).
 */

const RUPEES_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

/** Converts a rupee amount ('105', '105.5', 105.55) to integer paise. Throws RangeError('invalid_amount'). */
export function toPaise(rupees: string | number): number {
  if (typeof rupees === "number" && !Number.isFinite(rupees)) {
    throw new RangeError("invalid_amount");
  }
  const text = String(rupees).trim();
  const match = RUPEES_PATTERN.exec(text);
  if (!match) {
    throw new RangeError("invalid_amount");
  }
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const paise = whole * 100 + fraction;
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError("invalid_amount");
  }
  return paise;
}

/** Converts integer paise to a two-decimal rupee string for SQL numeric: 10550 -> '105.50'. */
export function fromPaise(paise: number): string {
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError("invalid_amount");
  }
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

/** Formats paise as rupees with Indian digit grouping and the 'Rs ' prefix: 'Rs 2,00,000' or 'Rs 610.00'. */
export function formatRupees(paise: number, opts?: { decimals?: boolean }): string {
  const digits = opts?.decimals === false ? 0 : 2;
  const formatter = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `Rs ${formatter.format(paise / 100)}`;
}
