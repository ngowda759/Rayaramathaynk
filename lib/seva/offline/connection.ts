/**
 * The counter's connection state for the status strip (Design Book 9.1, 9.11): online or offline since when, how many
 * outbox items are waiting, and the "Work offline" switch. A tiny external store (React reads it with
 * useSyncExternalStore); `get()` returns the same object until something changes.
 *
 * Also the one place that decides what a failed office call means. Calls throw the SevaClientError shape of
 * services/seva/http.ts - `{ code: string; status: number }`, status 0 for a timeout or a network failure.
 */

export interface ConnectionState {
  status: 'online' | 'offline';
  /** ISO time the counter went offline; null while online. */
  since: string | null;
  /** Outbox items not yet accepted by the office. */
  waiting: number;
  /** The "Work offline" switch. While it is on the status stays offline. */
  forced: boolean;
}

export interface ConnectionStore {
  get(): ConnectionState;
  subscribe(fn: (s: ConnectionState) => void): () => void;
  setForcedOffline(on: boolean): void;
  markOnline(): void;
  markOffline(at: Date): void;
  setWaiting(n: number): void;
}

export function createConnectionStore(): ConnectionStore {
  let state: ConnectionState = { status: 'online', since: null, waiting: 0, forced: false };
  const listeners = new Set<(s: ConnectionState) => void>();

  const set = (next: ConnectionState): void => {
    if (
      next.status === state.status &&
      next.since === state.since &&
      next.waiting === state.waiting &&
      next.forced === state.forced
    ) {
      return;
    }
    state = next;
    for (const fn of [...listeners]) fn(state);
  };

  return {
    get: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    setForcedOffline(on) {
      if (on) {
        set({ ...state, forced: true, status: 'offline', since: state.since ?? new Date().toISOString() });
      } else {
        // Stays offline until the next call that reaches the office marks it online.
        set({ ...state, forced: false });
      }
    },
    markOnline() {
      if (state.forced) return;
      set({ ...state, status: 'online', since: null });
    },
    markOffline(at) {
      if (state.status === 'offline') return;
      set({ ...state, status: 'offline', since: at.toISOString() });
    },
    setWaiting(n) {
      if (!Number.isSafeInteger(n) || n < 0) throw new RangeError('invalid_waiting_count');
      set({ ...state, waiting: n });
    },
  };
}

/** The counter page's one connection store. */
export const connectionStore: ConnectionStore = createConnectionStore();

/** The HTTP status of a failed call, or null when the error carries none. */
export function errorStatus(err: unknown): number | null {
  if (typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number') return err.status;
  return null;
}

/** The error code of a failed call, or null when the error carries none. */
export function errorCode(err: unknown): string | null {
  if (typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string' && err.code !== '') {
    return err.code;
  }
  return null;
}

/**
 * True when the office could not be reached or could not answer: a timeout or network failure (status 0), a server
 * failure (5xx), or an error with no HTTP status at all (fetch itself failed). A 4xx is an answer, never this.
 */
export function isUnreachable(err: unknown): boolean {
  const status = errorStatus(err);
  return status === null || status === 0 || status >= 500;
}
