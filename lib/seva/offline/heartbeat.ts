/**
 * The counter heartbeat (Design Book 8.3, 9.1, 9.12): every 60 s it tells the office how many outbox items wait, how
 * far this PC's clock is off and which app version runs; the answer raises this PC's OF floor to the server's last OF
 * number and says whether the day is closed. It also keeps the connection status honest.
 *
 * Clock skew = this PC's time minus the server's, measured at the middle of the call (positive: the PC is ahead).
 * It is measured from each answer and sent with the next beat.
 */
import { istParts } from '@/lib/seva/time';
import { raiseOfflineFloor } from './allocator';
import { connectionStore, isUnreachable } from './connection';
import type { SevaDb } from './db';
import { pendingCount } from './outbox';

export const HEARTBEAT_INTERVAL_MS = 60_000;
/** Reported to the office so it can tell which counter build a PC runs. Bump it with counter releases. */
export const COUNTER_APP_VERSION = 'seva-counter-1';

export interface HeartbeatAnswer {
  serverTime: string;
  ofSeries: string;
  lastOfNo: number;
  dayClosed: boolean;
}

export interface HeartbeatDeps {
  api: { heartbeat(b: { outboxCount: number; clockSkewMs: number; appVersion: string }): Promise<HeartbeatAnswer> };
  db: SevaDb;
  clock: () => Date;
  intervalMs?: number;
  onResult(r: { skewMs: number; dayClosed: boolean }): void;
}

/** Beats now and then every `intervalMs`; returns a function that stops it. */
export function startHeartbeat(deps: HeartbeatDeps): () => void {
  let stopped = false;
  let inFlight = false;
  let lastSkewMs = 0;

  const beat = async (): Promise<void> => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const outboxCount = await pendingCount(deps.db);
      const sentAt = deps.clock().getTime();
      let answer: HeartbeatAnswer;
      try {
        answer = await deps.api.heartbeat({ outboxCount, clockSkewMs: lastSkewMs, appVersion: COUNTER_APP_VERSION });
      } catch (err) {
        if (!stopped && isUnreachable(err)) connectionStore.markOffline(deps.clock());
        return;
      }
      const receivedAt = deps.clock().getTime();
      connectionStore.markOnline();
      connectionStore.setWaiting(outboxCount);
      const serverMs = Date.parse(answer.serverTime);
      if (Number.isNaN(serverMs)) return;
      const skewMs = Math.round((sentAt + receivedAt) / 2 - serverMs);
      lastSkewMs = skewMs;
      // lastOfNo is the server's count for its own IST year.
      await raiseOfflineFloor(deps.db, {
        series: answer.ofSeries,
        year: istParts(new Date(serverMs)).year,
        serverLastNo: answer.lastOfNo,
      });
      if (!stopped) deps.onResult({ skewMs, dayClosed: answer.dayClosed });
    } catch {
      // A local IndexedDB failure or a malformed answer must not stop the beat; the next one tries again.
    } finally {
      inFlight = false;
    }
  };

  void beat();
  const timer = setInterval(() => void beat(), deps.intervalMs ?? HEARTBEAT_INTERVAL_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
