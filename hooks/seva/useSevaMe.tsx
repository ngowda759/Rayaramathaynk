"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from "react";

import { useAuth } from "@/hooks/useAuth";
import { openSevaDb } from "@/lib/seva/offline/db";
import { deviceHeader, getDeviceCredentials } from "@/lib/seva/offline/device";
import { can as matrixCan, type PermissionContext } from "@/lib/seva/permissions";
import { SHELL } from "@/lib/seva/strings/shell";
import { businessDate } from "@/lib/seva/time";
import { SevaClientError, sevaFetch } from "@/services/seva/http";
import type { SevaAction, SevaMe } from "@/types/seva";

/**
 * The signed-in person's seva profile (`GET /api/seva/me`) for the module pages and the admin sidebar.
 *
 * One shared store per browser tab: the module layouts' SevaMeProvider and the sidebar (which sits outside them, in the
 * admin shell) read the same answer, so a page load makes one call. The call carries the counter device header when
 * this PC is registered; a refused or unknown device header is retried once without it, so a replaced PC still
 * reaches the pages that need no device.
 *
 * `can()` only hides things; the server checks every action again. It fills the two context facts the server fills
 * itself - the device's counter (from the server's answer, never from the caller) and today's IST business date.
 * People with no seva role (C-62) never call the API and are allowed nothing.
 */

export interface SevaMeValue {
  me: SevaMe | null;
  loading: boolean;
  /** A plain message when the profile could not be loaded (network, server). A refusal is not an error: me is null. */
  error: string | null;
  can(action: SevaAction, ctx?: PermissionContext): boolean;
  reload(): Promise<void>;
}

interface Snapshot {
  uid: string | null;
  me: SevaMe | null;
  loading: boolean;
  error: string | null;
}

interface SignedInUser {
  uid: string;
  getIdToken(): Promise<string>;
}

const IDLE: Snapshot = { uid: null, me: null, loading: false, error: null };

/** Answers that mean "this person may not use the module" rather than "something went wrong". */
const REFUSED = new Set(["unauthenticated", "forbidden", "staff_inactive", "view_only"]);

let snapshot: Snapshot = IDLE;
let inflight: Promise<void> | null = null;
let generation = 0;
const listeners = new Set<() => void>();

function publish(next: Snapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): Snapshot => snapshot;
const getServerSnapshot = (): Snapshot => IDLE;

/** This PC's `x-seva-device` value, or null when it is not a registered counter (or IndexedDB is unavailable). */
async function readDeviceHeader(): Promise<string | null> {
  try {
    const db = await openSevaDb();
    try {
      const credentials = await getDeviceCredentials(db);
      return credentials ? deviceHeader(credentials) : null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

async function fetchMe(user: SignedInUser): Promise<SevaMe> {
  const [token, header] = await Promise.all([user.getIdToken(), readDeviceHeader()]);
  try {
    return await sevaFetch<SevaMe>("/api/seva/me", { token, deviceHeader: header });
  } catch (err) {
    if (header && err instanceof SevaClientError && err.code.startsWith("device_")) {
      return sevaFetch<SevaMe>("/api/seva/me", { token, deviceHeader: null });
    }
    throw err;
  }
}

/** Loads the profile for `user` unless this tab already has (or is getting) it; `force` always reloads. */
function load(user: SignedInUser, force: boolean): Promise<void> {
  if (!force && snapshot.uid === user.uid) return inflight ?? Promise.resolve();
  const gen = ++generation;
  publish({ uid: user.uid, me: snapshot.uid === user.uid ? snapshot.me : null, loading: true, error: null });
  const run = (async () => {
    try {
      const me = await fetchMe(user);
      if (gen === generation) publish({ uid: user.uid, me, loading: false, error: null });
    } catch (err) {
      if (gen !== generation) return;
      if (err instanceof SevaClientError && REFUSED.has(err.code)) {
        publish({ uid: user.uid, me: null, loading: false, error: null });
      } else {
        const message = err instanceof SevaClientError ? err.message : SHELL.loadFailed.en;
        publish({ uid: user.uid, me: null, loading: false, error: message });
      }
    } finally {
      if (gen === generation) inflight = null;
    }
  })();
  inflight = run;
  return run;
}

function useSevaMeState(active: boolean): SevaMeValue {
  const { user, loading: authLoading, sevaRole } = useAuth();
  const shared = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const signedIn: SignedInUser | null = user ?? null;
  const eligible = active && signedIn !== null && sevaRole !== null && sevaRole !== undefined;

  useEffect(() => {
    if (eligible && signedIn) void load(signedIn, false);
  }, [eligible, signedIn]);

  const current = eligible && signedIn && shared.uid === signedIn.uid ? shared : null;
  const me = current?.me ?? null;
  const loading = active && (authLoading === true || (eligible && (current === null || current.loading)));
  const error = current?.error ?? null;

  const can = useCallback(
    (action: SevaAction, ctx?: PermissionContext): boolean => {
      if (!me) return false;
      return matrixCan(me, action, {
        ...ctx,
        counterIdOfDevice: me.counter?.id,
        todayBusinessDate: businessDate(new Date()),
      });
    },
    [me],
  );

  const reload = useCallback(async (): Promise<void> => {
    if (eligible && signedIn) await load(signedIn, true);
  }, [eligible, signedIn]);

  return useMemo(() => ({ me, loading, error, can, reload }), [me, loading, error, can, reload]);
}

const SevaMeContext = createContext<SevaMeValue | null>(null);

/** Loads /api/seva/me (with the device header when one is stored) for everything under it. */
export function SevaMeProvider({ children }: { children: ReactNode }): JSX.Element {
  const value = useSevaMeState(true);
  return <SevaMeContext.Provider value={value}>{children}</SevaMeContext.Provider>;
}

/** The seva profile from the nearest SevaMeProvider; outside one (the admin sidebar) it reads the same shared store. */
export function useSevaMe(): SevaMeValue {
  const provided = useContext(SevaMeContext);
  const own = useSevaMeState(provided === null);
  return provided ?? own;
}
