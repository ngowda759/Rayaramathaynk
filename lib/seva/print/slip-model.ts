/**
 * The printed receipt as plain text, top to bottom (Design Book 10.1). Pure: no I/O, no React.
 *
 * The model carries only what the slip prints. In particular it has no phone field and never copies one from the
 * receipt, whatever the receipt object holds (C-16, C-31): every devotee value is picked by name below.
 */
import { amountInWords } from "@/lib/seva/amount-words";
import { formatRupees } from "@/lib/seva/money";
import { receiptQrUrl } from "@/lib/seva/qr";
import { COMMON, type Bi } from "@/lib/seva/strings/common";
import { formatSevaDate, istParts } from "@/lib/seva/time";
import type { IssuedReceipt, SlipSettings } from "@/types/seva";

export interface SlipModel {
  header: {
    nameEn: string;
    nameKn: string;
    address: string[];
    registration: string | null;
    photoLeft: string | null;
    photoRight: string | null;
  };
  duplicate: { at: string; byStaffNo: string } | null;
  receiptNo: string;
  issuedLine: string;
  sevaDateLine: string;
  groupLine: string | null;
  devotee: { label: { en: string; kn: string }; value: string; valueKn?: string }[];
  lines: { nameEn: string; nameKn: string | null; qtyRate: string; amount: string; changed: boolean }[];
  total: string;
  totalWords: string;
  paymentLine: string;
  qrUrl: string;
  prasadamLine: { en: string; kn: string; date: string } | null;
  issuedBy: string;
  footer: string[];
  blessing: string;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Staff numbers print with three digits: 23 -> '023'. */
function staffNoText(n: number): string {
  return String(n).padStart(3, "0");
}

/** IST date and time as printed: '18-10-2026, 10:42 AM'. */
function slipDateTime(d: Date): string {
  const p = istParts(d);
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const half = p.hour < 12 ? "AM" : "PM";
  return `${pad2(p.day)}-${pad2(p.month)}-${p.year}, ${hour12}:${pad2(p.minute)} ${half}`;
}

/** Rupees without the prefix and with Indian grouping: 10500 -> '105.00'. */
function amountText(paise: number): string {
  return formatRupees(paise).replace(/^Rs /, "");
}

/** A rate as a plain number: 10500 -> '105'; 10550 -> '105.50'. */
function rateText(paise: number): string {
  return formatRupees(paise, { decimals: paise % 100 !== 0 }).replace(/^Rs /, "");
}

/** Whole rupees when the amount has no paise ('Rs 820'), else two decimals. */
function rupeesShort(paise: number): string {
  return formatRupees(paise, { decimals: paise % 100 !== 0 });
}

function nonEmpty(text: string | null | undefined): string | null {
  const t = text?.trim();
  return t ? t : null;
}

function devoteeRow(label: Bi, value: string | undefined, valueKn: string | undefined): SlipModel["devotee"][number] | null {
  const v = nonEmpty(value);
  if (!v) return null;
  const kn = nonEmpty(valueKn);
  const row: SlipModel["devotee"][number] = { label: { en: label.en, kn: label.kn }, value: v };
  if (kn && kn !== v) row.valueKn = kn;
  return row;
}

function paymentLine(r: IssuedReceipt): string {
  const together = r.count > 1 ? ` - ${rupeesShort(r.orderTotalPaise)} together for ${r.count} receipts` : "";
  switch (r.payment.mode) {
    case "cash":
      return r.count > 1 ? `Paid in cash${together}` : `Paid in cash - ${rupeesShort(r.totalPaise)}`;
    case "upi": {
      const ref = nonEmpty(r.payment.upiRefLast6);
      return `Paid by UPI${together}${ref ? ` - ref ending ${ref}` : ""}`;
    }
    case "online":
      return "Paid online by UPI";
  }
}

function issuedByLine(r: IssuedReceipt): string {
  if (r.channel === "web") return "Booked online - website";
  if (r.channel === "app") return "Booked online - temple app";
  const who = r.issuedBy.staffNo === null ? r.issuedBy.name : `${r.issuedBy.name} (${staffNoText(r.issuedBy.staffNo)})`;
  const counter = nonEmpty(r.counterName);
  return `Issued by: ${who}${counter ? ` - ${counter}` : ""}`;
}

/** Builds the slip for one issued receipt. `reprint` turns on the DUPLICATE band and the reprint line (C-22). */
export function toSlipModel(
  r: IssuedReceipt,
  s: SlipSettings,
  opts: { siteUrl: string; reprint?: { at: Date; byStaffNo: number } },
): SlipModel {
  const sevaDateLine = formatSevaDate(r.sevaDate);

  const devotee = [
    devoteeRow(COMMON.name, r.devotee.name, undefined),
    s.printGotra ? devoteeRow(COMMON.gotra, r.devotee.gotra, r.devotee.gotraKn) : null,
    s.printNakshatra ? devoteeRow(COMMON.nakshatra, r.devotee.nakshatra, r.devotee.nakshatraKn) : null,
    s.printRashi ? devoteeRow(COMMON.rashi, r.devotee.rashi, r.devotee.rashiKn) : null,
  ].filter((row): row is SlipModel["devotee"][number] => row !== null);

  const givesPrasadam = r.prasadam !== "none";

  return {
    header: {
      nameEn: s.templeNameEn,
      nameKn: s.templeNameKn,
      address: [s.addressLine1, s.addressLine2].map(nonEmpty).filter((a): a is string => a !== null),
      registration: nonEmpty(s.registrationLine),
      photoLeft: nonEmpty(s.photoLeftUrl),
      photoRight: nonEmpty(s.photoRightUrl),
    },
    duplicate: opts.reprint
      ? { at: slipDateTime(opts.reprint.at), byStaffNo: staffNoText(opts.reprint.byStaffNo) }
      : null,
    receiptNo: r.receiptNo,
    issuedLine: `Issued ${slipDateTime(new Date(r.issuedAt))}`,
    sevaDateLine,
    groupLine: r.count > 1 ? `${r.position} of ${r.count} - paid together - group ${r.groupNo}` : null,
    devotee,
    lines: r.lines.map((l) => ({
      nameEn: l.nameEn,
      nameKn: nonEmpty(l.nameKn),
      qtyRate: `${l.quantity} x ${rateText(l.unitRatePaise)}`,
      amount: amountText(l.amountPaise),
      changed: l.changed,
    })),
    total: formatRupees(r.totalPaise),
    totalWords: amountInWords(r.totalPaise),
    paymentLine: paymentLine(r),
    qrUrl: receiptQrUrl(opts.siteUrl, r.qrToken),
    prasadamLine: givesPrasadam
      ? { en: `${COMMON.showAtPrasadam.en} on ${sevaDateLine}`, kn: COMMON.showAtPrasadam.kn, date: sevaDateLine }
      : null,
    issuedBy: issuedByLine(r),
    footer: [s.footerLine1, s.footerLine2].map(nonEmpty).filter((f): f is string => f !== null),
    blessing: s.footerBlessing.trim(),
  };
}
