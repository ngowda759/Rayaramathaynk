/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto';
import { openSevaDb } from '@/lib/seva/offline/db';
import { raiseOfflineFloor, takeOfflineGroupNo, takeOfflineNumbers } from '@/lib/seva/offline/allocator';
import { createCounterSubmitter } from '@/lib/seva/offline/submitter';
import {
  deviceHeader,
  getDeviceCredentials,
  newDeviceSecret,
  saveDeviceCredentials,
  sha256HexBrowser,
} from '@/lib/seva/offline/device';
import { bookOrder, bootstrap, COUNTER, freshDb, idSequence, resetIndexedDb, STAFF } from './offline-fixtures';

describe('OF number allocator', () => {
  it('two tabs never get the same offline number', async () => {
    resetIndexedDb();
    const tabA = await openSevaDb();
    const tabB = await openSevaDb();

    const firsts = await Promise.all([
      takeOfflineNumbers(tabA, { series: 'OF1', year: 2026, count: 2 }),
      takeOfflineNumbers(tabB, { series: 'OF1', year: 2026, count: 2 }),
    ]);
    expect([...firsts].sort((a, b) => a - b)).toEqual([1, 3]);

    const many = await Promise.all(
      Array.from({ length: 10 }, (_, i) => takeOfflineNumbers(i % 2 === 0 ? tabA : tabB, { series: 'OF1', year: 2026, count: 1 })),
    );
    expect([...many].sort((a, b) => a - b)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it('raises the floor to the server number but never lowers it', async () => {
    const db = await freshDb();
    await raiseOfflineFloor(db, { series: 'OF1', year: 2026, serverLastNo: 41 });
    expect(await takeOfflineNumbers(db, { series: 'OF1', year: 2026, count: 1 })).toBe(42);

    await raiseOfflineFloor(db, { series: 'OF1', year: 2026, serverLastNo: 10 });
    expect(await takeOfflineNumbers(db, { series: 'OF1', year: 2026, count: 2 })).toBe(43);

    await raiseOfflineFloor(db, { series: 'OF1', year: 2026, serverLastNo: 44 });
    expect(await takeOfflineNumbers(db, { series: 'OF1', year: 2026, count: 1 })).toBe(45);
  });

  it('keeps numbers per series and per calendar year', async () => {
    const db = await freshDb();
    await raiseOfflineFloor(db, { series: 'OF1', year: 2026, serverLastNo: 7 });
    expect(await takeOfflineNumbers(db, { series: 'OF1', year: 2027, count: 1 })).toBe(1);
    expect(await takeOfflineNumbers(db, { series: 'OF2', year: 2026, count: 1 })).toBe(1);
    expect(await takeOfflineNumbers(db, { series: 'OF1', year: 2026, count: 1 })).toBe(8);
  });

  it('refuses a count or a floor that is not a whole number', async () => {
    const db = await freshDb();
    await expect(takeOfflineNumbers(db, { series: 'OF1', year: 2026, count: 0 })).rejects.toThrow(RangeError);
    await expect(takeOfflineNumbers(db, { series: 'OF1', year: 2026, count: 1.5 })).rejects.toThrow(RangeError);
    await expect(raiseOfflineFloor(db, { series: 'OF1', year: 2026, serverLastNo: -1 })).rejects.toThrow(RangeError);
    expect(await takeOfflineNumbers(db, { series: 'OF1', year: 2026, count: 1 })).toBe(1);
  });

  it('gives offline group numbers per series and month', async () => {
    const db = await freshDb();
    expect(await takeOfflineGroupNo(db, { yymm: '2610', series: 'OF1' })).toBe('G-2610-OF1-001');
    expect(await takeOfflineGroupNo(db, { yymm: '2610', series: 'OF1' })).toBe('G-2610-OF1-002');
    expect(await takeOfflineGroupNo(db, { yymm: '2611', series: 'OF1' })).toBe('G-2611-OF1-001');
    expect(await takeOfflineGroupNo(db, { yymm: '2610', series: 'OF2' })).toBe('G-2610-OF2-001');
  });

  it('offline numbers take month and year from the PC clock in IST', async () => {
    const db = await freshDb();
    const submitterAt = (iso: string) =>
      createCounterSubmitter({
        db,
        api: { issue: jest.fn() },
        clock: () => new Date(iso),
        askPrintOffline: jest.fn(async () => true),
        staff: () => STAFF,
        counter: () => COUNTER,
        catalogue: () => bootstrap(),
        isForcedOffline: () => true,
        newIds: idSequence(),
      });

    const newYear = await submitterAt('2026-12-31T18:31:00Z').submit(bookOrder());
    if (newYear.mode !== 'offline') throw new Error('expected an offline save');
    expect(newYear.receipts.map((r) => r.receiptNo)).toEqual([
      'OF1-023-01-2027/000001',
      'OF1-023-01-2027/000002',
      'OF1-023-01-2027/000003',
    ]);
    expect(newYear.receipts[0].groupNo).toBe('G-2701-OF1-001');
    expect(newYear.receipts[0].issuedAt).toBe('2026-12-31T18:31:00.000Z');

    const oldYear = await submitterAt('2026-12-31T18:29:59Z').submit(bookOrder());
    if (oldYear.mode !== 'offline') throw new Error('expected an offline save');
    expect(oldYear.receipts[0].receiptNo).toBe('OF1-023-12-2026/000001');
    expect(oldYear.receipts[0].groupNo).toBe('G-2612-OF1-001');
  });
});

describe('device credentials', () => {
  it('makes a 32-byte base64url secret', () => {
    const secret = newDeviceSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Set(Array.from({ length: 200 }, newDeviceSecret)).size).toBe(200);
  });

  it('hashes with SHA-256 like the server', async () => {
    expect(await sha256HexBrowser('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('keeps the credentials in IndexedDB and builds the device header', async () => {
    const db = await freshDb();
    expect(await getDeviceCredentials(db)).toBeNull();
    const secret = newDeviceSecret();
    await saveDeviceCredentials(db, { deviceId: '3f1d2c4b-0000-4000-8000-000000000001', secret });
    const saved = await getDeviceCredentials(db);
    expect(saved).toEqual({ deviceId: '3f1d2c4b-0000-4000-8000-000000000001', secret });
    expect(deviceHeader(saved!)).toBe(`3f1d2c4b-0000-4000-8000-000000000001.${secret}`);
  });

  it('refuses credentials that would break the header', async () => {
    const db = await freshDb();
    await expect(saveDeviceCredentials(db, { deviceId: 'a.b', secret: newDeviceSecret() })).rejects.toThrow(RangeError);
    await expect(saveDeviceCredentials(db, { deviceId: 'abc', secret: '' })).rejects.toThrow(RangeError);
    expect(await getDeviceCredentials(db)).toBeNull();
  });
});
