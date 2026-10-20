/**
 * Amount in words for the printed slip (Design Book 10.1 item 9): Indian numbering (thousand, lakh, crore), English.
 * 61000 paise -> 'Rupees Six Hundred Ten only'; 10550 -> 'Rupees One Hundred Five and Fifty Paise only'.
 */

const ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  return n % 10 === 0 ? tens : `${tens} ${ONES[n % 10]}`;
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest > 0) parts.push(belowHundred(rest));
  return parts.join(" ");
}

/** Words for a whole number in the Indian system; crores above 99 repeat the system ('One Hundred Crore'). */
function indianWords(n: number): string {
  if (n === 0) return ONES[0];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore > 0) parts.push(`${indianWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest > 0) parts.push(belowThousand(rest));
  return parts.join(" ");
}

/** Amount in words, Indian system, English. Throws RangeError('invalid_amount') for negative or fractional paise. */
export function amountInWords(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new RangeError("invalid_amount");
  }
  const rupees = Math.floor(paise / 100);
  const remainder = paise % 100;
  const paisePart = remainder > 0 ? ` and ${belowHundred(remainder)} Paise` : "";
  return `Rupees ${indianWords(rupees)}${paisePart} only`;
}
