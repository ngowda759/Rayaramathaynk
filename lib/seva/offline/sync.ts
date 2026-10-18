/**
 * Sends the outbox to the office (Design Book 8.3, 9.11): on the `online` event, every 30 s while the counter is
 * open, and on "Send now". Items go one per call, in issue order, so each answer belongs to exactly one item and a
 * failure leaves everything after it waiting. Every send is idempotent on the server (client ids), so sending an
 * item again after a lost answer is safe.
 *
 * Per item: accepted or already there (duplicate) -> removed from the outbox; refused by the office -> kept, reported
 * and the next item is tried (a printed slip is never dropped on this PC; it stays waiting until a person deals with
 * it); office unreachable or busy -> stop and try again later. A sign-in or device problem is thrown to the caller.
 */
import type { OutboxItem, SyncResponse } from '@/types/seva';
import { connectionStore, errorCode, errorStatus, isUnreachable } from './connection';
import type { SevaDb } from './db';
import { markSent, pendingCount, pendingItems } from './outbox';

export interface SyncSummary {
  sent: number;
  refused: { seq: number; code: string }[];
  stoppedBy: 'network' | null;
}

export interface SyncDeps {
  db: SevaDb;
  api: { sync(items: OutboxItem[]): Promise<SyncResponse> };
}

const running = new WeakMap<SevaDb, Promise<SyncSummary>>();

/** True when the answer for this item means the office now has what it asks for. */
function isDone(item: OutboxItem, result: SyncResponse['results'][number]): boolean {
  if (result.ok || result.duplicate === true) return true;
  // An offline cancel of a receipt that is already cancelled has nothing left to do.
  return item.kind === 'cancel' && result.code === 'already_cancelled';
}

async function sendAll({ db, api }: SyncDeps): Promise<SyncSummary> {
  const summary: SyncSummary = { sent: 0, refused: [], stoppedBy: null };
  let reached = false;
  try {
    for (const item of await pendingItems(db)) {
      let response: SyncResponse;
      try {
        response = await api.sync([item]);
      } catch (err) {
        const status = errorStatus(err);
        if (status === 400) {
          // The office refused this one item as invalid; the rest may still go.
          reached = true;
          summary.refused.push({ seq: item.seq, code: errorCode(err) ?? 'validation' });
          continue;
        }
        if (isUnreachable(err) || status === 429) {
          summary.stoppedBy = 'network';
          break;
        }
        throw err;
      }
      reached = true;
      const result = response.results.find((r) => r.seq === item.seq);
      if (!result) {
        // No answer for what was sent: keep it and everything after it for the next run.
        summary.stoppedBy = 'network';
        break;
      }
      if (isDone(item, result)) {
        await markSent(db, item.seq);
        summary.sent += 1;
      } else {
        summary.refused.push({ seq: item.seq, code: result.code ?? 'refused' });
      }
    }
  } finally {
    if (reached) connectionStore.markOnline();
    connectionStore.setWaiting(await pendingCount(db));
  }
  return summary;
}

/** Sends everything waiting. A second call while one is running in this tab shares the running one. */
export async function runSync(deps: SyncDeps): Promise<SyncSummary> {
  const current = running.get(deps.db);
  if (current) return current;
  const work = sendAll(deps).finally(() => running.delete(deps.db));
  running.set(deps.db, work);
  return work;
}
