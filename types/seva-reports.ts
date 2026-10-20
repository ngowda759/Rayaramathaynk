/**
 * Seva Entry - dashboard, needs-attention and continuity DTOs (wire format).
 *
 * Built by the report routes (Task A3-3) from the SQL functions seva_dashboard, seva_needs_attention and
 * seva_continuity (supabase/migrations/20261021000200_seva_functions_admin.sql). The SQL returns amounts as numeric
 * strings in rupees; the routes convert them to integer paise. Dates are 'YYYY-MM-DD' (IST), times ISO-8601 strings.
 */
import type { Period } from '@/lib/seva/time';

export interface DashboardTotals {
  totalPaise: number;
  receipts: number;
  cashPaise: number;
  upiPaise: number;
  onlinePaise: number;
}

export interface DashboardData {
  period: Period;
  asOf: string;
  /** `prev` is null when no previous span was asked for. */
  tiles: DashboardTotals & { prev: DashboardTotals | null };
  hero: {
    /** One bucket per IST hour (05:00-22:00), day or month; `key` matches the keys in `prev`. */
    buckets: { key: string; label: string; cashPaise: number; upiPaise: number; onlinePaise: number }[];
    /** The previous span shifted onto the current keys (the ghost line). */
    prev: { key: string; totalPaise: number }[];
  };
  topSevas: {
    sevaId: string;
    nameEn: string;
    nameKn: string | null;
    amountPaise: number;
    quantity: number;
    prevAmountPaise: number;
  }[];
  mode: { cashPaise: number; upiPaise: number; onlinePaise: number };
  /** Counter visits by IST ISO weekday (1 = Monday) and hour. */
  rush: { dow: number; hour: number; count: number }[];
  calendar: { date: string; totalPaise: number }[];
  festivalDates: string[];
}

export type NeedsAttentionId =
  | 'changed_amounts'
  | 'cancellations'
  | 'day_close_difference'
  | 'day_not_closed'
  | 'waiting_to_sync'
  | 'number_gaps'
  | 'prasadam_pending'
  | 'upi_refunds_due'
  | 'clock_skew'
  | 'backup'
  | 'database_size'
  | 'in_doubt_duplicates'
  | 'future_offline'
  /** Cancels sent by a counter outbox; attention when sent by someone else or late (A3 security gate M-2). */
  | 'offline_cancels'
  /** The counter's UPI payee changed in the finance settings (A3 security gate H-1). */
  | 'upi_changed'
  /** Offline receipts that reached the office after their counter-day was closed (A5-FIX M-2). */
  | 'synced_into_closed_day'
  /** Online (C series) receipts of today with no print record 10 minutes after saving (A5-FIX F5, from H-3). */
  | 'unprinted_online';

/** One offline cancel on the `offline_cancels` card, newest first. */
export interface OfflineCancelEntry {
  receiptNo: string;
  /** When it was cancelled on the PC, as the outbox says. */
  recordedAt: string;
  /** When the outbox sent it to the server. */
  receivedAt: string;
  cancelledBy: string;
  syncedBy: string;
  /** Sent by someone other than the canceller, or more than the cancel window after `recordedAt`. */
  flagged: boolean;
}

export interface NeedsAttentionCard {
  id: NeedsAttentionId;
  level: 'ok' | 'attention' | 'critical';
  count: number;
  detail: Record<string, string | number>;
  /** Only on `offline_cancels`: at most 50 entries. */
  entries?: OfflineCancelEntry[];
}

/** One open row of `receipt_number_gaps` (DB §8.5): running numbers `fromNo`-`toNo` of a series-year are missing. */
export interface ContinuityGap {
  id: number;
  series: string;
  year: number;
  fromNo: number;
  toNo: number;
  cause: 'device_replaced' | 'missing_in_sync';
  detectedAt: string;
}

export interface ContinuityRow {
  series: string;
  year: number;
  counterName: string | null;
  firstNo: string | null;
  lastNo: string | null;
  numbers: number;
  issued: number;
  cancelled: number;
  openGaps: number;
  /** The open gaps of this series-year, lowest range first; present only when `openGaps` > 0 (the register's Resolve). */
  gaps?: ContinuityGap[];
}
