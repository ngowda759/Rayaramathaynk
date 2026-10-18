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
  | 'future_offline';

export interface NeedsAttentionCard {
  id: NeedsAttentionId;
  level: 'ok' | 'attention' | 'critical';
  count: number;
  detail: Record<string, string | number>;
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
}
