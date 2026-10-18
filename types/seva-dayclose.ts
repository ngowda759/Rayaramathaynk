/**
 * Close-day screen data (DB 9.10) in wire form: camelCase, money in integer paise, dates 'YYYY-MM-DD'.
 *
 * Built by the route from `seva_prepare_day_close(p_counter_id, p_business_date)`, which returns snake_case JSON with
 * money as numeric strings ('1110.00'); the route converts each amount with `toPaise()`.
 * - `receipts`, `cancelled`, `changed`: issued receipts, cancelled receipts, issued receipts with a changed amount.
 * - `cashExpectedPaise`: the counter's opening float plus its issued cash receipts of the date.
 * - `outboxPending`: the live counter PC's last reported outbox count; closing needs 0.
 * - `seriesRanges`: per C/OF series of the counter, the first and last receipt number of the date (null when none),
 *   issued and cancelled counts, and the series' open number gaps.
 * - `denominations`: the shown cash denominations in display order, for the count rows.
 */
export interface DayClosePrep {
  counterId: number;
  businessDate: string;
  status: 'open' | 'closed' | 'reopened';
  openingFloatPaise: number;
  receipts: number;
  cancelled: number;
  changed: number;
  cashExpectedPaise: number;
  upiCount: number;
  upiExpectedPaise: number;
  outboxPending: number;
  seriesRanges: { series: string; first: string | null; last: string | null; issued: number; cancelled: number; openGaps: number }[];
  denominations: { kind: 'note' | 'coin'; valuePaise: number }[];
}
