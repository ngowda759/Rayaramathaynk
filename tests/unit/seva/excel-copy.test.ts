/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto';
import {
  allowExcelFolder,
  chooseExcelFolder,
  excelFolderStatus,
  writeDayCopy,
  type FolderDb,
} from '@/lib/seva/excel/folder';
import { createExcelCopyScheduler, issuedToExportRow } from '@/lib/seva/excel/copyScheduler';
import type { ExportReceiptRow } from '@/types/seva-export';
import { NOW, issuedReceipt, uuid } from './offline-fixtures';

type Permission = 'granted' | 'prompt' | 'denied';

interface FakeFolder {
  db: FolderDb;
  handle: FileSystemDirectoryHandle;
  writes: { name: string; bytes: number }[];
  requestPermission: jest.Mock<Promise<Permission>, []>;
  setPermission(p: Permission): void;
}

/** A folder the receptionist picked, kept in a Map-backed stand-in for the IndexedDB 'files' store. */
function fakeFolder(permission: Permission = 'granted'): FakeFolder {
  let current: Permission = permission;
  const writes: { name: string; bytes: number }[] = [];
  const requestPermission = jest.fn(async (): Promise<Permission> => {
    current = 'granted';
    return current;
  });
  const handle = {
    kind: 'directory',
    name: 'Seva receipts',
    queryPermission: async (): Promise<Permission> => current,
    requestPermission,
    getFileHandle: async (name: string) => ({
      createWritable: async () => ({
        write: async (data: ArrayBuffer) => {
          writes.push({ name, bytes: data.byteLength });
        },
        close: async () => undefined,
      }),
    }),
  } as unknown as FileSystemDirectoryHandle;
  const store = new Map<string, FileSystemDirectoryHandle>();
  const db: FolderDb = {
    get: async (_store, key) => store.get(key),
    put: async (_store, value, key) => {
      store.set(key, value);
      return key;
    },
  };
  return { db, handle, writes, requestPermission, setPermission: (p) => (current = p) };
}

type PickerGlobal = { showDirectoryPicker?: (o: { mode: 'readwrite'; id: string }) => Promise<FileSystemDirectoryHandle> };
const pickerGlobal = globalThis as PickerGlobal;

async function pickFolder(folder: FakeFolder): Promise<void> {
  pickerGlobal.showDirectoryPicker = jest.fn(async () => folder.handle);
  await chooseExcelFolder(folder.db);
}

afterEach(() => {
  delete pickerGlobal.showDirectoryPicker;
  jest.useRealTimers();
});

describe('Excel copy folder', () => {
  it('reports unsupported when the browser has no folder picker', async () => {
    const folder = fakeFolder();
    expect(await excelFolderStatus(folder.db)).toBe('unsupported');
    expect(await chooseExcelFolder(folder.db)).toBeNull();
  });

  it('reports not_set until a folder is chosen, then ready', async () => {
    const folder = fakeFolder();
    pickerGlobal.showDirectoryPicker = jest.fn(async () => folder.handle);
    expect(await excelFolderStatus(folder.db)).toBe('not_set');
    expect(await writeDayCopy(folder.db, '2026-10-18', new ArrayBuffer(4))).toBe('not_set');

    expect(await chooseExcelFolder(folder.db)).toEqual({ name: 'Seva receipts' });
    expect(pickerGlobal.showDirectoryPicker).toHaveBeenCalledWith({ mode: 'readwrite', id: 'seva-receipts' });
    expect(await excelFolderStatus(folder.db)).toBe('ready');
  });

  it('returns null when the receptionist closes the folder picker', async () => {
    const folder = fakeFolder();
    pickerGlobal.showDirectoryPicker = jest.fn(async () => {
      throw new DOMException('The user aborted a request.', 'AbortError');
    });
    expect(await chooseExcelFolder(folder.db)).toBeNull();
    expect(await excelFolderStatus(folder.db)).toBe('not_set');
  });

  it('reports needs_permission when permission is prompt', async () => {
    const folder = fakeFolder('prompt');
    await pickFolder(folder);
    expect(await excelFolderStatus(folder.db)).toBe('needs_permission');
    expect(await writeDayCopy(folder.db, '2026-10-18', new ArrayBuffer(4))).toBe('needs_permission');
    expect(folder.writes).toHaveLength(0);

    expect(await allowExcelFolder(folder.db)).toBe(true);
    expect(folder.requestPermission).toHaveBeenCalledTimes(1);
    expect(await excelFolderStatus(folder.db)).toBe('ready');
  });

  it('writes <YYYY-MM-DD>.xlsx into the chosen folder', async () => {
    const folder = fakeFolder();
    await pickFolder(folder);
    expect(await writeDayCopy(folder.db, '2026-10-18', new ArrayBuffer(16))).toBe('written');
    expect(folder.writes).toEqual([{ name: '2026-10-18.xlsx', bytes: 16 }]);
  });
});

describe('Excel copy scheduler', () => {
  function setup(folder: FakeFolder, clock: () => Date = () => NOW) {
    const getRows = jest.fn(async (): Promise<ExportReceiptRow[]> => []);
    const build = jest.fn(async (): Promise<ArrayBuffer> => new ArrayBuffer(8));
    const onStatus = jest.fn();
    const scheduler = createExcelCopyScheduler({ db: folder.db, getRows, build, clock, onStatus });
    return { scheduler, getRows, build, onStatus };
  }

  it('writes after 20 receipts and after 30 seconds, only when something changed', async () => {
    const folder = fakeFolder();
    await pickFolder(folder);
    jest.useFakeTimers();
    const { scheduler } = setup(folder);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(folder.writes).toHaveLength(0); // nothing changed yet

    scheduler.noteReceipts(3);
    await jest.advanceTimersByTimeAsync(29_000);
    expect(folder.writes).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(folder.writes).toHaveLength(1);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(folder.writes).toHaveLength(1); // clean: no rewrite

    scheduler.noteReceipts(19);
    await jest.advanceTimersByTimeAsync(0);
    expect(folder.writes).toHaveLength(1);
    scheduler.noteReceipts(1); // the 20th receipt since the last write
    await jest.advanceTimersByTimeAsync(0);
    expect(folder.writes).toHaveLength(2);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(folder.writes).toHaveLength(2);
    expect(folder.writes.every((w) => w.name === '2026-10-18.xlsx')).toBe(true);
    scheduler.stop();
  });

  it('flushNow writes at once', async () => {
    const folder = fakeFolder();
    await pickFolder(folder);
    const { scheduler, getRows, build, onStatus } = setup(folder);
    await scheduler.flushNow();
    expect(getRows).toHaveBeenCalledWith('2026-10-18');
    expect(build).toHaveBeenCalledTimes(1);
    expect(folder.writes).toEqual([{ name: '2026-10-18.xlsx', bytes: 8 }]);
    expect(onStatus).toHaveBeenLastCalledWith('written');
    scheduler.stop();
  });

  it('keeps the change and reports needs_permission until the folder is allowed again', async () => {
    const folder = fakeFolder('prompt');
    await pickFolder(folder);
    jest.useFakeTimers();
    const { scheduler, build, onStatus } = setup(folder);

    scheduler.noteReceipts(1);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(onStatus).toHaveBeenLastCalledWith('needs_permission');
    expect(build).not.toHaveBeenCalled();
    expect(folder.writes).toHaveLength(0);

    folder.setPermission('granted');
    await jest.advanceTimersByTimeAsync(30_000);
    expect(folder.writes).toHaveLength(1);
    expect(onStatus).toHaveBeenLastCalledWith('written');
    scheduler.stop();
  });

  it('reports not_set and builds nothing without a folder', async () => {
    const folder = fakeFolder();
    const { scheduler, build, onStatus } = setup(folder);
    await scheduler.flushNow();
    expect(build).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenLastCalledWith('not_set');
    scheduler.stop();
  });

  it("still writes the previous day's file for receipts noted before midnight IST", async () => {
    const folder = fakeFolder();
    await pickFolder(folder);
    let now = new Date('2026-10-18T18:29:50.000Z'); // 23:59:50 IST on 18 Oct
    const { scheduler, getRows } = setup(folder, () => now);
    scheduler.noteReceipts(1);
    now = new Date('2026-10-18T18:30:10.000Z'); // 00:00:10 IST on 19 Oct
    await scheduler.flushNow();
    expect(getRows.mock.calls.map((c) => c[0])).toEqual(['2026-10-18', '2026-10-19']);
    expect(folder.writes.map((w) => w.name)).toEqual(['2026-10-18.xlsx', '2026-10-19.xlsx']);
    scheduler.stop();
  });

  it('keeps working after a failed folder check and reports the failure', async () => {
    const folder = fakeFolder();
    await pickFolder(folder);
    const realGet = folder.db.get;
    let failNext = true;
    const db: FolderDb = {
      put: folder.db.put,
      get: async (store, key) => {
        if (failNext) {
          failNext = false;
          throw new DOMException('The database connection is closing.', 'InvalidStateError');
        }
        return realGet(store, key);
      },
    };
    const onError = jest.fn();
    const onStatus = jest.fn();
    const build = jest.fn(async (): Promise<ArrayBuffer> => new ArrayBuffer(8));
    const scheduler = createExcelCopyScheduler({ db, getRows: async () => [], build, clock: () => NOW, onStatus, onError });

    await expect(scheduler.flushNow()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(build).not.toHaveBeenCalled();
    expect(folder.writes).toHaveLength(0);

    await expect(scheduler.flushNow()).resolves.toBeUndefined();
    expect(folder.writes).toEqual([{ name: '2026-10-18.xlsx', bytes: 8 }]);
    expect(onStatus).toHaveBeenLastCalledWith('written');
    expect(onError).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('stop ends the 30-second timer', async () => {
    const folder = fakeFolder();
    await pickFolder(folder);
    jest.useFakeTimers();
    const { scheduler } = setup(folder);
    scheduler.noteReceipts(1);
    scheduler.stop();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(folder.writes).toHaveLength(0);
  });
});

describe('issuedToExportRow', () => {
  it('maps an issued receipt to an export row without the phone', () => {
    // A server answer could carry more devotee fields than the wire type names; the phone must never come through.
    const devotee = { name: 'Venkatesh Rao', gotra: 'Bharadwaja', nakshatra: 'Rohini', rashi: 'Vrishabha', phone: '+919845012345' };
    const receipt = issuedReceipt({
      clientReceiptId: uuid(1),
      receiptNo: 'C1-023-10-2026/000124',
      issuedAt: NOW.toISOString(), // 10:42 IST
      devotee,
      payment: { mode: 'upi', upiRefLast6: '123456' },
    });
    const row = issuedToExportRow(receipt);
    expect(row).toEqual({
      receiptNo: 'C1-023-10-2026/000124',
      series: 'C1',
      date: '2026-10-18',
      time: '10:42',
      devoteeName: 'Venkatesh Rao',
      sevas: 'Panchamrita Abhisheka',
      amountPaise: 10500,
      mode: 'upi',
      status: 'issued',
      gotra: 'Bharadwaja',
      nakshatra: 'Rohini',
      rashi: 'Vrishabha',
      sevaCodes: 'PAN',
      upiRefLast6: '123456',
      issuedBy: 'Ramesh - 023',
      prasadam: 'pending',
      changed: false,
      cancelReason: '',
      incomeLedgers: [{ ledger: 'Seva Income - Panchamrita Abhisheka', amountPaise: 10500 }],
    });
    expect(row).not.toHaveProperty('phone');
    expect(JSON.stringify(row)).not.toContain('9845012345');
  });

  it('shows quantities, marks changed amounts and keeps the offline series', () => {
    const receipt = issuedReceipt({
      clientReceiptId: uuid(2),
      receiptNo: 'OF1-023-10-2026/000007',
      issuedAt: NOW.toISOString(),
      totalPaise: 71000,
      lines: [
        {
          lineNo: 1,
          sevaId: 'seva-paa',
          code: 'PAA',
          nameEn: 'Paaduka Pooja',
          nameKn: null,
          quantity: 1,
          unitRatePaise: 50000,
          amountPaise: 50000,
          changed: true,
          prasadamItems: null,
        },
        {
          lineNo: 2,
          sevaId: 'seva-pan',
          code: 'PAN',
          nameEn: 'Panchamrita Abhisheka',
          nameKn: null,
          quantity: 2,
          unitRatePaise: 10500,
          amountPaise: 21000,
          changed: false,
          prasadamItems: null,
        },
      ],
    });
    const row = issuedToExportRow(receipt);
    expect(row.series).toBe('OF1');
    expect(row.sevas).toBe('Paaduka Pooja, Panchamrita Abhisheka x 2');
    expect(row.sevaCodes).toBe('PAA, PAN');
    expect(row.changed).toBe(true);
    expect(row.amountPaise).toBe(71000);
    expect(row.incomeLedgers).toEqual([
      { ledger: 'Seva Income - Paaduka Pooja', amountPaise: 50000 },
      { ledger: 'Seva Income - Panchamrita Abhisheka', amountPaise: 21000 },
    ]);
  });
});
