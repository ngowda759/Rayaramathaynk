/**
 * The counter PC's own IndexedDB (Design Book 8.3, 8.4, 9.11). Browser only; nothing here talks to the network.
 *
 * Stores:
 * - meta       small values by key: device credentials, OF counters (`of:<series>:<year>`), offline group counters,
 *              the outbox sequence and the profile salt
 * - outbox     orders and cancels made offline, by `seq` (issue order), until the office has them
 * - today      local copies of issued receipts (online and offline) by `clientReceiptId`, indexed by IST business date
 * - catalogue  the last counter bootstrap, under the key 'current'
 * - profiles   returning-devotee profiles with hashed phones, by `phoneHash`
 * - files      the Excel copy folder handle (File System Access API)
 */
import { openDB, type DBSchema, type IDBPDatabase, type IDBPObjectStore, type StoreNames } from 'idb';
import type { CounterBootstrap, IssuedReceipt, OutboxItem } from '@/types/seva';
import type { CachedProfile } from './profiles';

export const SEVA_DB_NAME = 'seva-counter';
export const SEVA_DB_VERSION = 1;

/** A receipt kept on this PC: `sent` is true once the office has its issue. */
export type LocalReceipt = IssuedReceipt & { businessDate: string; sent: boolean };

export interface SevaDbSchema extends DBSchema {
  meta: { key: string; value: unknown };
  outbox: { key: number; value: OutboxItem };
  today: { key: string; value: LocalReceipt; indexes: { byDate: string } };
  catalogue: { key: 'current'; value: CounterBootstrap };
  profiles: { key: string; value: CachedProfile };
  files: { key: string; value: FileSystemDirectoryHandle };
}

export type SevaDb = IDBPDatabase<SevaDbSchema>;

export type SevaStoreName = StoreNames<SevaDbSchema>;

/** A store opened read-write inside any transaction that includes it, so helpers can share one transaction. */
export type WritableStore<Name extends SevaStoreName, TxStores extends ArrayLike<SevaStoreName>> = IDBPObjectStore<
  SevaDbSchema,
  TxStores,
  Name,
  'readwrite'
>;

/**
 * Runs `work` inside `tx` and waits for the commit. If `work` throws, the transaction is aborted so none of its writes
 * are kept (an offline number is never taken without its receipt). Only IndexedDB requests may be awaited in `work`;
 * any other await lets the transaction commit early.
 */
export async function runTransaction<T>(
  tx: { done: Promise<void>; abort(): void },
  work: () => Promise<T>,
): Promise<T> {
  try {
    const result = await work();
    await tx.done;
    return result;
  } catch (err) {
    try {
      tx.abort();
    } catch {
      // Already finished or aborted by the failed request.
    }
    tx.done.catch(() => undefined);
    throw err;
  }
}

/** Opens (and on first use creates) the counter database. Each call returns its own connection. */
export function openSevaDb(): Promise<SevaDb> {
  return openDB<SevaDbSchema>(SEVA_DB_NAME, SEVA_DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('meta');
        db.createObjectStore('outbox', { keyPath: 'seq' });
        const today = db.createObjectStore('today', { keyPath: 'clientReceiptId' });
        today.createIndex('byDate', 'businessDate');
        db.createObjectStore('catalogue');
        db.createObjectStore('profiles', { keyPath: 'phoneHash' });
        db.createObjectStore('files');
      }
    },
  });
}
