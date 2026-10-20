/**
 * @jest-environment node
 */
/**
 * Plan A4P-5 review fix: the slip prints the Kannada names temple admins keep (a corrected nakshatra or rashi spelling,
 * an added gotra), online (fromSqlIssue) and offline (the counter submitter, from the cached bootstrap), and a
 * returning devotee's added gotra keeps its id. Without the lists the built-in names are used.
 */
import 'fake-indexeddb/auto';
import { profileToDraft } from '@/lib/seva/counter/payload';
import { GOTRAS } from '@/lib/seva/domain/gotras';
import { NAKSHATRAS } from '@/lib/seva/domain/nakshatras';
import { RASHIS } from '@/lib/seva/domain/rashis';
import { connectionStore } from '@/lib/seva/offline/connection';
import type { SevaDb } from '@/lib/seva/offline/db';
import { createCounterSubmitter } from '@/lib/seva/offline/submitter';
import { fromSqlIssue } from '@/lib/seva/server/counter';
import type { CounterOrderPayload, IssueResponse, SevaListItem, SevaLists } from '@/types/seva';
import { bookOrder, bootstrap, COUNTER, freshDb, idSequence, NOW, STAFF } from './offline-fixtures';

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }));

const CORRECTED = 'ಪೂರ್ವಾಭಾದ್ರಪದ';
const MESHA_CORRECTED = 'ಮೇಷ ರಾಶಿ';

function item(p: Partial<SevaListItem> & Pick<SevaListItem, 'id' | 'nameEn'>): SevaListItem {
  return { nameKn: null, knChecked: false, active: true, displayOrder: p.id, ...p };
}

const LISTS: SevaLists = {
  gotras: [
    ...GOTRAS.map((g) => item({ id: g.id, nameEn: g.en, nameKn: g.kn, active: g.id !== 12 })),
    item({ id: 1000, nameEn: 'Vyaghrapada', nameKn: 'ವ್ಯಾಘ್ರಪಾದ', displayOrder: 57 }),
  ],
  nakshatras: NAKSHATRAS.map((n) => item({ id: n.id, nameEn: n.en, nameKn: n.id === 25 ? CORRECTED : n.kn })),
  rashis: RASHIS.map((r) => item({ id: r.id, nameEn: r.en, nameKn: r.id === 1 ? MESHA_CORRECTED : r.kn })),
};

const BUILT_IN_25 = NAKSHATRAS.find((n) => n.id === 25)?.kn;
const BUILT_IN_MESHA = RASHIS.find((r) => r.id === 1)?.kn;
const SHANDILYA_KN = GOTRAS.find((g) => g.id === 12)?.kn;

function sqlAnswer(devotee: Record<string, unknown>): Record<string, unknown> {
  return {
    order_id: '00000000-0000-4000-8000-000000000500',
    group_no: 'G-2610-0042',
    duplicate: false,
    receipts: [
      {
        id: '00000000-0000-4000-8000-000000000600',
        client_receipt_id: '00000000-0000-4000-8000-000000000011',
        receipt_no: 'C1-023-10-2026/000124',
        series_code: 'C1',
        seva_date: '2026-10-20',
        group_no: 'G-2610-0042',
        position: 1,
        count: 1,
        order_total: '105.00',
        total: '105.00',
        lines: [
          {
            line_no: 1,
            seva_id: '22222222-2222-4222-8222-222222222222',
            code: 'PAN',
            name_en: 'Panchamrita Abhisheka',
            name_kn: null,
            quantity: 1,
            unit_rate: '105.00',
            amount: '105.00',
            changed: false,
            prasadam_items: null,
          },
        ],
        payment: { mode: 'cash' },
        devotee,
        qr_token: 'TOKEN00000000000000011',
        issued_at: '2026-10-18T10:42:00+05:30',
        issued_by: { name: 'Ramesh', staff_no: 23 },
        counter_name: 'Counter 1',
        channel: 'counter',
        issued_offline: false,
        status: 'issued',
        print_count: 0,
        prasadam: 'pending',
      },
    ],
  };
}

describe('slip names from the admins lists, online', () => {
  it('prints a corrected nakshatra and rashi Kannada and an added gotra Kannada', () => {
    const answer = fromSqlIssue(
      sqlAnswer({ name: 'Lakshmi', gotra: 'Vyaghrapada', gotra_id: 1000, nakshatra_id: 25, rashi_id: 1 }),
      LISTS,
    );
    expect(answer.receipts[0].devotee).toEqual({
      name: 'Lakshmi',
      gotra: 'Vyaghrapada',
      gotraKn: 'ವ್ಯಾಘ್ರಪಾದ',
      nakshatra: 'Purva Bhadrapada',
      nakshatraKn: CORRECTED,
      rashi: 'Mesha',
      rashiKn: MESHA_CORRECTED,
    });
  });

  it('still prints a hidden gotra Kannada, since a receipt may carry one', () => {
    const answer = fromSqlIssue(sqlAnswer({ name: 'Lakshmi', gotra: 'Shandilya', gotra_id: 12 }), LISTS);
    expect(answer.receipts[0].devotee.gotraKn).toBe(SHANDILYA_KN);
  });

  it('uses the built-in names when the lists are absent', () => {
    const answer = fromSqlIssue(sqlAnswer({ name: 'Lakshmi', gotra: 'Vyaghrapada', gotra_id: 1000, nakshatra_id: 25, rashi_id: 1 }));
    expect(answer.receipts[0].devotee).toEqual({
      name: 'Lakshmi',
      gotra: 'Vyaghrapada',
      nakshatra: 'Purva Bhadrapada',
      nakshatraKn: BUILT_IN_25,
      rashi: 'Mesha',
      rashiKn: BUILT_IN_MESHA,
    });
  });
});

describe('slip names from the admins lists, offline', () => {
  let db: SevaDb;

  beforeEach(async () => {
    db = await freshDb();
    connectionStore.setForcedOffline(false);
    connectionStore.markOnline();
    connectionStore.setWaiting(0);
  });

  function order(): CounterOrderPayload {
    const o = bookOrder();
    o.devotee = { name: 'Lakshmi', gotra: { text: 'Vyaghrapada', id: 1000 }, nakshatra: { id: 25 }, rashi: { id: 1 } };
    return o;
  }

  async function issueOffline(lists: SevaLists | undefined) {
    const submitter = createCounterSubmitter({
      db,
      api: { issue: jest.fn<Promise<IssueResponse>, [CounterOrderPayload]>() },
      clock: () => NOW,
      askPrintOffline: async () => true,
      staff: () => STAFF,
      counter: () => COUNTER,
      catalogue: () => ({ ...bootstrap(), ...(lists ? { lists } : {}) }),
      isForcedOffline: () => true,
      newIds: idSequence(900),
    });
    const result = await submitter.submit(order());
    if (result.mode !== 'offline') throw new Error('expected an offline save');
    return result.receipts[0].devotee;
  }

  it('prints a corrected nakshatra and rashi Kannada and an added gotra Kannada from the cached bootstrap', async () => {
    expect(await issueOffline(LISTS)).toEqual({
      name: 'Lakshmi',
      gotra: 'Vyaghrapada',
      gotraKn: 'ವ್ಯಾಘ್ರಪಾದ',
      nakshatra: 'Purva Bhadrapada',
      nakshatraKn: CORRECTED,
      rashi: 'Mesha',
      rashiKn: MESHA_CORRECTED,
    });
  });

  it('uses the built-in names when the cached bootstrap has no lists', async () => {
    expect(await issueOffline(undefined)).toEqual({
      name: 'Lakshmi',
      gotra: 'Vyaghrapada',
      nakshatra: 'Purva Bhadrapada',
      nakshatraKn: BUILT_IN_25,
      rashi: 'Mesha',
      rashiKn: BUILT_IN_MESHA,
    });
  });
});

describe('a returning devotee with an added gotra', () => {
  it('keeps the gotra id when the bootstrap lists carry it, and only the text without them', () => {
    const profile = { name: 'Lakshmi', gotra: 'Vyaghrapada', gotraId: 1000 };
    expect(profileToDraft(profile, LISTS).gotra).toEqual({ value: '1000', text: 'Vyaghrapada' });
    expect(profileToDraft(profile).gotra).toEqual({ text: 'Vyaghrapada' });
    expect(profileToDraft({ name: 'Lakshmi', gotraId: 1000 }, LISTS).gotra).toEqual({ value: '1000', text: 'Vyaghrapada' });
  });
});
