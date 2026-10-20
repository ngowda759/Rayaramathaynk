/**
 * Groups counter lines by seva date (Design Book 9.3): each date becomes one receipt; sevas on the same date share it.
 * Limits (C-30): at most 8 lines on one receipt and at most 31 receipts in one order.
 */

export const MAX_LINES_PER_RECEIPT = 8;
export const MAX_RECEIPTS_PER_ORDER = 31;

export interface CounterLine {
  key: string;
  sevaId: string;
  quantity: number;
  unitRatePaise: number;
  catalogueRatePaise: number | null;
  changeReason?: string;
  dates: string[];
}

export interface ReceiptGroup {
  sevaDate: string;
  lines: (Omit<CounterLine, "dates"> & { amountPaise: number })[];
  totalPaise: number;
}

export type GroupResult =
  | { ok: true; receipts: ReceiptGroup[]; totalPaise: number }
  | { ok: false; code: "no_lines" | "too_many_lines_on_date" | "too_many_receipts"; date?: string };

/** Dates ascending; lines keep entry order within each date. A date repeated on one line counts once. */
export function groupLinesByDate(lines: CounterLine[]): GroupResult {
  const byDate = new Map<string, ReceiptGroup>();
  for (const line of lines) {
    const { dates, ...rest } = line;
    const amountPaise = line.quantity * line.unitRatePaise;
    for (const date of new Set(dates)) {
      const group = byDate.get(date) ?? { sevaDate: date, lines: [], totalPaise: 0 };
      group.lines.push({ ...rest, amountPaise });
      group.totalPaise += amountPaise;
      byDate.set(date, group);
    }
  }

  if (byDate.size === 0) return { ok: false, code: "no_lines" };

  const receipts = [...byDate.values()].sort((a, b) => (a.sevaDate < b.sevaDate ? -1 : a.sevaDate > b.sevaDate ? 1 : 0));
  if (receipts.length > MAX_RECEIPTS_PER_ORDER) return { ok: false, code: "too_many_receipts" };

  const crowded = receipts.find((g) => g.lines.length > MAX_LINES_PER_RECEIPT);
  if (crowded) return { ok: false, code: "too_many_lines_on_date", date: crowded.sevaDate };

  const totalPaise = receipts.reduce((sum, g) => sum + g.totalPaise, 0);
  return { ok: true, receipts, totalPaise };
}
