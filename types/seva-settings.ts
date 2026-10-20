/**
 * Wire types shared by the seva catalogue and settings routes (`/api/seva/sevas*`, `/api/seva/settings/*`) and their
 * browser clients (services/seva/catalogue.service.ts, services/seva/settings.service.ts). Kept here, outside the
 * server-only repositories, so a browser module never has to import from lib/seva/server/*.
 */

/** The answer to a seva create or edit: the saved id and whether the Firestore `sevas` mirror succeeded. */
export interface SaveSevaResult {
  id: string;
  mirror: "ok" | "failed";
}

/** One rate change of a seva; `by` is the staff member's name ('' when not recorded). */
export interface RateHistoryEntry {
  oldPaise: number | null;
  newPaise: number;
  reason: string;
  by: string;
  at: string;
}

/** The counter rules page (DB §13.2). The two always-required switches are deliberately absent. */
export interface CounterRules {
  cancelWindowMinutes: number;
  counterDaysAhead: number;
  onlineDaysAhead: number;
  onlineSameDayCutoff: string;
  prasadamUndoSeconds: number;
  dayCloseFlagThresholdPaise: number;
  tallyCashLedger: string;
  tallyUpiLedger: string;
  tallyOnlineLedger: string;
  tallyColumns: Record<string, string> | null;
}

/** One festival with its dates (YYYY-MM-DD). */
export interface FestivalItem {
  id: string;
  nameEn: string;
  nameKn: string | null;
  active: boolean;
  dates: string[];
}

/** One counter with its online and offline receipt series. */
export interface CounterItem {
  id: number;
  name: string;
  place: string | null;
  openingFloatPaise: number;
  active: boolean;
  onlineSeries: string | null;
  offlineSeries: string | null;
}

/** A newly added counter and the series made for it. */
export interface NewCounter {
  id: number;
  onlineSeries: string;
  offlineSeries: string;
}
