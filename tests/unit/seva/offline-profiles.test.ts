/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto';
import type { SevaDb } from '@/lib/seva/offline/db';
import { cacheProfile, findProfiles } from '@/lib/seva/offline/profiles';
import { freshDb } from './offline-fixtures';

let db: SevaDb;

beforeEach(async () => {
  db = await freshDb();
});

async function rawRecords(d: SevaDb): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const store of ['meta', 'profiles', 'outbox', 'today', 'catalogue'] as const) {
    out.push(...(await d.getAll(store)));
  }
  return out;
}

describe('cached devotee profiles', () => {
  it('never stores a plain phone number in the profile cache', async () => {
    await cacheProfile(db, {
      phoneE164: '+919845012345',
      name: 'Venkatesh Rao',
      gotra: 'Bharadwaja',
      gotraId: 2,
      nakshatraId: 4,
      rashiId: 2,
      lastSeen: '2026-09-12',
    });

    const [profile] = await db.getAll('profiles');
    expect(profile.phoneLast4).toBe('2345');
    expect(profile.phoneHash).toMatch(/^[0-9a-f]{64}$/);
    const raw = JSON.stringify(await rawRecords(db));
    expect(raw).not.toContain('+919845012345');
    expect(raw).not.toContain('9845012345');
    for (const record of await rawRecords(db)) {
      if (record && typeof record === 'object') {
        for (const value of Object.values(record)) expect(value).not.toBe('+919845012345');
      }
    }
  });

  it('finds cached profiles by name prefix and by phone', async () => {
    await cacheProfile(db, { phoneE164: '+919845012345', name: 'Venkatesh Rao', nakshatraId: 4, lastSeen: '2026-09-12' });
    await cacheProfile(db, { phoneE164: '+919845000001', name: 'Venkatesh Murthy', lastSeen: '2026-10-01' });
    await cacheProfile(db, { phoneE164: '+919845000002', name: 'ವೆಂಕಟೇಶ ಭಟ್', lastSeen: '2026-08-01' });
    await cacheProfile(db, { phoneE164: '+919845000003', name: 'Lakshmi Devi', lastSeen: '2026-10-02' });

    expect((await findProfiles(db, { name: 'venk' })).map((p) => p.name)).toEqual(['Venkatesh Murthy', 'Venkatesh Rao']);
    expect((await findProfiles(db, { name: '  RAO ' })).map((p) => p.name)).toEqual(['Venkatesh Rao']);
    expect((await findProfiles(db, { name: 'ವೆಂಕ' })).map((p) => p.name)).toEqual(['ವೆಂಕಟೇಶ ಭಟ್']);
    expect(await findProfiles(db, { name: 'xyz' })).toEqual([]);
    expect(await findProfiles(db, { name: '   ' })).toEqual([]);

    const byPhone = await findProfiles(db, { phoneE164: '+919845012345' });
    expect(byPhone).toHaveLength(1);
    expect(byPhone[0]).toMatchObject({ name: 'Venkatesh Rao', phoneLast4: '2345', nakshatraId: 4, lastSeen: '2026-09-12' });
    expect(await findProfiles(db, { phoneE164: '+919999999999' })).toEqual([]);

    const both = await findProfiles(db, { phoneE164: '+919845000003', name: 'venk' });
    expect(both.map((p) => p.name)).toEqual(['Lakshmi Devi', 'Venkatesh Murthy', 'Venkatesh Rao']);
  });

  it('updates a returning devotee instead of adding a second profile', async () => {
    await cacheProfile(db, { phoneE164: '+919845012345', name: 'Venkatesh Rao', lastSeen: '2026-09-12' });
    await cacheProfile(db, { phoneE164: '+919845012345', name: 'Venkatesh Rao', gotra: 'Bharadwaja', lastSeen: '2026-10-18' });

    const all = await db.getAll('profiles');
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ gotra: 'Bharadwaja', lastSeen: '2026-10-18' });
  });

  it('salts the hash per PC, so the same phone hashes differently elsewhere', async () => {
    await cacheProfile(db, { phoneE164: '+919845012345', name: 'Venkatesh Rao', lastSeen: '2026-09-12' });
    const [here] = await db.getAll('profiles');
    const otherPc = await freshDb();
    await cacheProfile(otherPc, { phoneE164: '+919845012345', name: 'Venkatesh Rao', lastSeen: '2026-09-12' });
    const [there] = await otherPc.getAll('profiles');
    expect(there.phoneHash).not.toBe(here.phoneHash);
  });

  it('finds nothing by phone before anything was cached', async () => {
    expect(await findProfiles(db, { phoneE164: '+919845012345' })).toEqual([]);
  });

  it('refuses a phone that is not normalised', async () => {
    await expect(cacheProfile(db, { phoneE164: '98450 12345', name: 'Venkatesh Rao', lastSeen: '2026-09-12' })).rejects.toThrow(RangeError);
    expect(await db.getAll('profiles')).toEqual([]);
  });
});
