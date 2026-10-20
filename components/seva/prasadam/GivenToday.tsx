"use client";

import { useCallback, useEffect, useRef, useState, type JSX } from "react";

import { PRASADAM } from "@/lib/seva/strings/prasadam";
import { businessDate } from "@/lib/seva/time";

/**
 * "Given 36" in the prasadam header (DB §11): how many receipts this person marked given today on this phone or PC.
 * No API answers the day's count, so the page counts its own gives (and takes back an undone one). Kept in
 * localStorage per person and IST day as a convenience only: a private window or cleared storage starts at 0, and
 * nothing else reads it.
 */

const KEY_PREFIX = "seva.prasadam.given.v1:";

function storageKey(staffId: string, day: string): string {
  return `${KEY_PREFIX}${staffId}:${day}`;
}

/** The stored ids, or null when storage cannot be read (private window, blocked site data). */
function readIds(key: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return null;
  }
}

function writeIds(key: string, ids: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Storage blocked or full: the count still works for this visit.
  }
}

/** Drops this person's counts of earlier days. */
function pruneOtherDays(staffId: string, keep: string): void {
  try {
    const store = window.localStorage;
    const mine = `${KEY_PREFIX}${staffId}:`;
    const stale: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && key.startsWith(mine) && key !== keep) stale.push(key);
    }
    stale.forEach((key) => store.removeItem(key));
  } catch {
    // Nothing to prune when storage is unavailable.
  }
}

export interface GivenTodayCount {
  count: number;
  add(receiptId: string): void;
  remove(receiptId: string): void;
}

function loadToday(staffId: string | null): string[] {
  return staffId ? (readIds(storageKey(staffId, businessDate(new Date()))) ?? []) : [];
}

export function useGivenToday(staffId: string | null): GivenTodayCount {
  const [state, setState] = useState(() => ({ staffId, ids: loadToday(staffId) }));
  const idsRef = useRef<string[]>(state.ids);
  let ids = state.ids;
  if (state.staffId !== staffId) {
    // Another person signed in on this device: show their count (state adjusted while rendering).
    ids = loadToday(staffId);
    setState({ staffId, ids });
  }

  useEffect(() => {
    if (staffId) pruneOtherDays(staffId, storageKey(staffId, businessDate(new Date())));
  }, [staffId]);

  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);

  const update = useCallback(
    (change: (current: string[]) => string[]) => {
      if (!staffId) return;
      const key = storageKey(staffId, businessDate(new Date()));
      // Storage is the source when it can be read (another tab may have counted too); otherwise this visit's list.
      const next = change(readIds(key) ?? idsRef.current);
      writeIds(key, next);
      idsRef.current = next;
      setState({ staffId, ids: next });
    },
    [staffId],
  );

  const add = useCallback(
    (receiptId: string) => update((current) => (current.includes(receiptId) ? current : [...current, receiptId])),
    [update],
  );
  const remove = useCallback((receiptId: string) => update((current) => current.filter((id) => id !== receiptId)), [update]);

  return { count: ids.length, add, remove };
}

export function GivenToday({ count }: { count: number }): JSX.Element {
  const label = PRASADAM.givenCount(count);
  return (
    <span
      role="status"
      title={PRASADAM.givenCountHint.en}
      data-testid="prasadam-given-today"
      className="inline-flex h-[34px] shrink-0 items-center rounded-full border border-(--border) bg-(--card) px-3.5 text-(length:--text-meta) font-semibold whitespace-nowrap tabular-nums"
    >
      {label.en}
      <span className="sr-only">{` - ${PRASADAM.givenCountHint.en}`}</span>
    </span>
  );
}

export default GivenToday;
