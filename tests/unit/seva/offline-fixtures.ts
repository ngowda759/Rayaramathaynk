/**
 * Shared fixtures for the offline engine tests (tests/unit/seva/offline-*.test.ts). Each test file runs in the
 * node environment with fake-indexeddb; freshDb() gives every test its own empty IndexedDB.
 */
import { IDBFactory } from 'fake-indexeddb';
import { openSevaDb, type SevaDb } from '@/lib/seva/offline/db';
import type {
  CatalogueSeva,
  CounterBootstrap,
  CounterOrderPayload,
  IssueResponse,
  IssuedReceipt,
  OfflineOrderPayload,
} from '@/types/seva';

/** A new, empty IndexedDB for this test (like a fresh PC). */
export function resetIndexedDb(): void {
  globalThis.indexedDB = new IDBFactory();
}

export async function freshDb(): Promise<SevaDb> {
  resetIndexedDb();
  return openSevaDb();
}

export const STAFF = { name: 'Ramesh', staffNo: 23 };
export const COUNTER = { name: 'Counter 1', offlineSeries: 'OF1' };
/** 10:42 IST on Sun 18 Oct 2026. */
export const NOW = new Date('2026-10-18T05:12:00.000Z');

export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** A 22-character QR token. */
export function token(n: number): string {
  return `TOKEN${String(n).padStart(17, '0')}`;
}

export function idSequence(start = 900): () => { clientOrderId: string } {
  let n = start;
  return () => ({ clientOrderId: uuid(n++) });
}

/** The error shape services/seva/http.ts throws (SevaClientError: code + HTTP status, 0 for timeout/network). */
export class FakeClientError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
    this.name = 'SevaClientError';
  }
}

function seva(p: Partial<CatalogueSeva> & Pick<CatalogueSeva, 'id' | 'code' | 'key' | 'nameEn' | 'ratePaise'>): CatalogueSeva {
  return {
    nameKn: null,
    multiDate: false,
    allowAmountChange: true,
    prasadamGiven: false,
    prasadamItems: null,
    visibility: 'both',
    active: true,
    category: 'Pooja',
    incomeLedger: null,
    ...p,
  };
}

export const PANCHAMRITA = seva({
  id: 'seva-pan',
  code: 'PAN',
  key: 1,
  nameEn: 'Panchamrita Abhisheka',
  nameKn: 'ಪಂಚಾಮೃತ ಅಭಿಷೇಕ',
  ratePaise: 10500,
  multiDate: true,
  prasadamGiven: true,
  prasadamItems: 'Tirtha, prasada',
});
export const PAADUKA = seva({ id: 'seva-paa', code: 'PAA', key: 2, nameEn: 'Paaduka Pooja', nameKn: 'ಪಾದುಕಾ ಪೂಜೆ', ratePaise: 50500 });
export const KARNIKE = seva({ id: 'seva-kar', code: 'KAR', key: 3, nameEn: 'Other Seva / Karnike', ratePaise: null, visibility: 'counter' });

export function bootstrap(catalogue: CatalogueSeva[] = [PANCHAMRITA, PAADUKA, KARNIKE]): CounterBootstrap {
  return {
    counter: { id: 1, name: COUNTER.name, onlineSeries: 'C1', offlineSeries: COUNTER.offlineSeries },
    catalogue,
    slip: {
      templeNameEn: 'Sri Raghavendra Swamy Matha',
      templeNameKn: 'ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ',
      addressLine1: 'Sample address line 1',
      addressLine2: 'Sample address line 2',
      registrationLine: null,
      photoLeftUrl: null,
      photoRightUrl: null,
      footerLine1: 'Footer 1',
      footerLine2: 'Footer 2',
      footerBlessing: 'Blessing',
      printGotra: true,
      printNakshatra: true,
      printRashi: true,
    },
    rules: { cancelWindowMinutes: 30, amountChangeReasonRequired: true, counterDaysAhead: 365, cashDifferenceNoteRequired: true },
    denominations: [{ kind: 'note', valuePaise: 50000 }],
    festivalChips: [],
    nextNumbers: [{ series: 'C1', nextRunningNo: 124 }],
    lastOfNo: 0,
    today: { businessDate: '2026-10-18', receipts: 0, cashPaise: 0, upiPaise: 0, dayClosed: false },
    upi: null,
    upiDisabledReason: 'not_configured',
    serverTime: NOW.toISOString(),
    siteUrl: 'https://site.example',
  };
}

/** The Design Book example: Paaduka + Panchamrita on day 1 (610), Panchamrita on days 2 and 3 (105 each) = 820. */
export function bookOrder(): CounterOrderPayload {
  return {
    clientOrderId: uuid(1),
    devotee: {
      name: 'Venkatesh Rao',
      gotra: { text: 'Bharadwaja', id: 2 },
      nakshatra: { id: 4 },
      rashi: { id: 2 },
      phone: '+919845012345',
    },
    receipts: [
      {
        clientReceiptId: uuid(11),
        sevaDate: '2026-10-20',
        qrToken: token(11),
        lines: [
          { sevaId: PAADUKA.id, quantity: 1 },
          { sevaId: PANCHAMRITA.id, quantity: 1 },
        ],
      },
      { clientReceiptId: uuid(12), sevaDate: '2026-10-21', qrToken: token(12), lines: [{ sevaId: PANCHAMRITA.id, quantity: 1 }] },
      { clientReceiptId: uuid(13), sevaDate: '2026-10-22', qrToken: token(13), lines: [{ sevaId: PANCHAMRITA.id, quantity: 1 }] },
    ],
    payment: { mode: 'cash', cashReceivedPaise: 100000 },
    expectedTotalPaise: 82000,
  };
}

/** A minimal issued receipt for list and prune tests. */
export function issuedReceipt(p: Partial<IssuedReceipt> & Pick<IssuedReceipt, 'clientReceiptId' | 'receiptNo' | 'issuedAt'>): IssuedReceipt {
  return {
    id: null,
    seriesCode: p.receiptNo.split('-')[0],
    sevaDate: '2026-10-20',
    groupNo: 'G-2610-0001',
    position: 1,
    count: 1,
    orderTotalPaise: 10500,
    totalPaise: 10500,
    lines: [
      {
        lineNo: 1,
        sevaId: PANCHAMRITA.id,
        code: 'PAN',
        nameEn: PANCHAMRITA.nameEn,
        nameKn: PANCHAMRITA.nameKn,
        quantity: 1,
        unitRatePaise: 10500,
        amountPaise: 10500,
        changed: false,
        prasadamItems: PANCHAMRITA.prasadamItems,
      },
    ],
    payment: { mode: 'cash' },
    devotee: { name: 'Venkatesh Rao' },
    qrToken: token(99),
    issuedBy: { name: STAFF.name, staffNo: STAFF.staffNo },
    counterName: COUNTER.name,
    channel: 'counter',
    issuedOffline: false,
    status: 'issued',
    printCount: 0,
    prasadam: 'pending',
    ...p,
  };
}

/** What the office answers for an online save: C1 numbers from `firstNo`. */
export function onlineAnswer(p: CounterOrderPayload, firstNo = 124): IssueResponse {
  const groupNo = 'G-2610-0042';
  const totals = p.receipts.map((r) => (r.lines.length === 2 ? 61000 : 10500));
  const orderTotal = totals.reduce((a, b) => a + b, 0);
  return {
    orderId: uuid(500),
    groupNo,
    duplicate: false,
    receipts: p.receipts.map((r, i) =>
      issuedReceipt({
        id: uuid(600 + i),
        clientReceiptId: r.clientReceiptId,
        receiptNo: `C1-023-10-2026/${String(firstNo + i).padStart(6, '0')}`,
        issuedAt: NOW.toISOString(),
        sevaDate: r.sevaDate,
        groupNo,
        position: i + 1,
        count: p.receipts.length,
        orderTotalPaise: orderTotal,
        totalPaise: totals[i],
        qrToken: r.qrToken,
      }),
    ),
  };
}

/** A small offline order payload for outbox and sync tests. */
export function offlinePayload(n: number): OfflineOrderPayload {
  return {
    clientOrderId: uuid(700 + n),
    devotee: { name: `Devotee ${n}` },
    payment: { mode: 'cash', cashReceivedPaise: 10500 },
    expectedTotalPaise: 10500,
    issuerStaffNo: STAFF.staffNo,
    issuedAt: NOW.toISOString(),
    groupNo: `G-2610-OF1-${String(n).padStart(3, '0')}`,
    receipts: [
      {
        clientReceiptId: uuid(800 + n),
        sevaDate: '2026-10-20',
        qrToken: token(800 + n),
        runningNo: n,
        receiptNo: `OF1-023-10-2026/${String(n).padStart(6, '0')}`,
        lines: [{ sevaId: PANCHAMRITA.id, quantity: 1, cachedRatePaise: 10500 }],
      },
    ],
  };
}
