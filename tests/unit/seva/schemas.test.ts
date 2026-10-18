import { randomUUID } from 'crypto';
import {
  cancelSchema,
  counterOrderSchema,
  dayCloseSchema,
  denominationsSchema,
  devoteeSchema,
  exportAuditSchema,
  gapResolveSchema,
  offlineOrderSchema,
  prasadamGiveSchema,
  sevaUpsertSchema,
  staffUpdateSchema,
  syncRequestSchema,
} from '@/lib/seva/schemas';

const QR = 'AbCdEfGhIjKlMnOpQrSt_-';

function line(quantity = 1) {
  return { sevaId: randomUUID(), quantity };
}

function receipt(lines = [line()], sevaDate = '2026-10-20') {
  return { clientReceiptId: randomUUID(), sevaDate, qrToken: QR, lines };
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    clientOrderId: randomUUID(),
    devotee: { name: 'Venkatesh Rao' },
    receipts: [receipt()],
    payment: { mode: 'cash' },
    expectedTotalPaise: 50500,
    ...overrides,
  };
}

describe('devoteeSchema', () => {
  test.each([
    ['  ವೆಂಕಟೇಶ  ', 'ok', 'ವೆಂಕಟೇಶ'],
    ['Venkatesh Rao 🙏', 'ok', 'Venkatesh Rao 🙏'],
    ['x'.repeat(81), 'error', null],
    ['   ', 'error', null],
  ])('devotee name %j', (name, kind, want) => {
    const result = devoteeSchema.safeParse({ name });
    expect(result.success).toBe(kind === 'ok');
    if (result.success) expect(result.data.name).toBe(want);
  });

  it('keeps an 80-character name', () => {
    expect(devoteeSchema.safeParse({ name: 'y'.repeat(80) }).success).toBe(true);
  });

  test.each([
    ['98450 12345', '+919845012345'],
    ['+91 98450-12345', '+919845012345'],
    ['09845012345', '+919845012345'],
    ['5845012345', null],
    ['abc', null],
    ['984501234', null],
  ])('phone %j', (phone, want) => {
    const result = devoteeSchema.safeParse({ name: 'Rao', phone });
    if (want === null) {
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join('.') === 'phone');
        expect(issue).toBeDefined();
        expect(issue?.message).toBe('Enter a 10-digit mobile number');
        expect(issue?.code === 'custom' && (issue.params as { code?: string } | undefined)?.code).toBe('invalid_phone');
      }
    } else {
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.phone).toBe(want);
    }
  });

  it('treats an empty phone as not given', () => {
    const result = devoteeSchema.safeParse({ name: 'Rao', phone: '  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBeUndefined();
  });

  it('limits gotra text to 60 and nakshatra and rashi ids to their ranges', () => {
    expect(devoteeSchema.safeParse({ name: 'R', gotra: { text: 'g'.repeat(61) } }).success).toBe(false);
    expect(devoteeSchema.safeParse({ name: 'R', nakshatra: { id: 28 } }).success).toBe(false);
    expect(devoteeSchema.safeParse({ name: 'R', rashi: { id: 13 } }).success).toBe(false);
    expect(
      devoteeSchema.safeParse({ name: 'R', gotra: { text: 'Bharadwaj', id: 2 }, nakshatra: { id: 4 }, rashi: { id: 12 } })
        .success,
    ).toBe(true);
  });
});

describe('counterOrderSchema', () => {
  it('accepts a normal cash order', () => {
    expect(counterOrderSchema.safeParse(order()).success).toBe(true);
  });

  it('refuses 9 lines on one receipt, quantity 0 and 100, and 32 receipts', () => {
    const nine = Array.from({ length: 9 }, () => line());
    expect(counterOrderSchema.safeParse(order({ receipts: [receipt(nine)] })).success).toBe(false);
    const eight = Array.from({ length: 8 }, () => line());
    expect(counterOrderSchema.safeParse(order({ receipts: [receipt(eight)] })).success).toBe(true);
    expect(counterOrderSchema.safeParse(order({ receipts: [receipt([line(0)])] })).success).toBe(false);
    expect(counterOrderSchema.safeParse(order({ receipts: [receipt([line(100)])] })).success).toBe(false);
    expect(counterOrderSchema.safeParse(order({ receipts: [receipt([line(99)])] })).success).toBe(true);
    const many = Array.from({ length: 32 }, () => receipt());
    expect(counterOrderSchema.safeParse(order({ receipts: many })).success).toBe(false);
    expect(counterOrderSchema.safeParse(order({ receipts: many.slice(0, 31) })).success).toBe(true);
    expect(counterOrderSchema.safeParse(order({ receipts: [] })).success).toBe(false);
  });

  it('refuses a bad QR token, a bad date and a non-uuid id', () => {
    const r = receipt();
    expect(counterOrderSchema.safeParse(order({ receipts: [{ ...r, qrToken: 'short' }] })).success).toBe(false);
    expect(counterOrderSchema.safeParse(order({ receipts: [{ ...r, sevaDate: '20-10-2026' }] })).success).toBe(false);
    expect(counterOrderSchema.safeParse(order({ clientOrderId: 'abc' })).success).toBe(false);
  });

  it('needs 6 digits and the tick for UPI', () => {
    expect(
      counterOrderSchema.safeParse(order({ payment: { mode: 'upi', upiRefLast6: '11904' } })).success,
    ).toBe(false);
    expect(
      counterOrderSchema.safeParse(order({ payment: { mode: 'upi', upiRefLast6: '119042' } })).success,
    ).toBe(false);
    expect(
      counterOrderSchema.safeParse(order({ payment: { mode: 'upi', upiRefLast6: '119042', upiSeenConfirmed: true } }))
        .success,
    ).toBe(true);
  });

  it('refuses an online payment mode at the counter and a non-positive total', () => {
    expect(counterOrderSchema.safeParse(order({ payment: { mode: 'online' } })).success).toBe(false);
    expect(counterOrderSchema.safeParse(order({ expectedTotalPaise: 0 })).success).toBe(false);
  });
});

describe('offlineOrderSchema and syncRequestSchema', () => {
  function offline() {
    return {
      ...order(),
      issuerStaffNo: 23,
      issuedAt: '2026-10-20T05:12:00.000Z',
      groupNo: 'G-2610-0042',
      receipts: [
        {
          ...receipt(),
          runningNo: 7,
          receiptNo: 'OF1-023-10-2026/000007',
          lines: [{ ...line(), cachedRatePaise: 50500 }],
        },
      ],
    };
  }

  it('accepts an offline order and refuses a receipt number over 40 characters', () => {
    expect(offlineOrderSchema.safeParse(offline()).success).toBe(true);
    const bad = offline();
    bad.receipts[0].receiptNo = 'x'.repeat(41);
    expect(offlineOrderSchema.safeParse(bad).success).toBe(false);
  });

  it("needs the issuer's staff number (001-999) on every offline order", () => {
    const withoutIssuer: Record<string, unknown> = { ...offline() };
    delete withoutIssuer.issuerStaffNo;
    expect(offlineOrderSchema.safeParse(withoutIssuer).success).toBe(false);
    for (const issuerStaffNo of [0, 1000, 23.5, '23']) {
      expect({ issuerStaffNo, ok: offlineOrderSchema.safeParse({ ...offline(), issuerStaffNo }).success }).toEqual({
        issuerStaffNo,
        ok: false,
      });
    }
    expect(offlineOrderSchema.safeParse({ ...offline(), issuerStaffNo: 999 }).success).toBe(true);
  });

  it('accepts 1..200 outbox items', () => {
    const item = { seq: 1, kind: 'order', payload: offline() };
    const cancel = {
      seq: 2,
      kind: 'cancel',
      clientReceiptIds: [randomUUID()],
      reasonCode: 'wrong_seva',
      at: '2026-10-20T05:13:00.000Z',
      cancelledByStaffNo: 23,
    };
    expect(syncRequestSchema.safeParse({ items: [item, cancel] }).success).toBe(true);
    expect(syncRequestSchema.safeParse({ items: [] }).success).toBe(false);
    const many = Array.from({ length: 201 }, (_, i) => ({ ...cancel, seq: i + 1 }));
    expect(syncRequestSchema.safeParse({ items: many }).success).toBe(false);
  });

  it("needs the staff number (001-999) of whoever cancelled offline on every outbox cancel", () => {
    const cancel = {
      seq: 1,
      kind: 'cancel',
      clientReceiptIds: [randomUUID()],
      reasonCode: 'wrong_seva',
      at: '2026-10-20T05:13:00.000Z',
    };
    expect(syncRequestSchema.safeParse({ items: [cancel] }).success).toBe(false);
    for (const cancelledByStaffNo of [0, 1000, 23.5, '23']) {
      expect({ cancelledByStaffNo, ok: syncRequestSchema.safeParse({ items: [{ ...cancel, cancelledByStaffNo }] }).success }).toEqual({
        cancelledByStaffNo,
        ok: false,
      });
    }
    expect(syncRequestSchema.safeParse({ items: [{ ...cancel, cancelledByStaffNo: 1 }] }).success).toBe(true);
  });
});

describe('cancelSchema', () => {
  it('needs a note when the cancel reason is other', () => {
    const ids = [randomUUID()];
    expect(cancelSchema.safeParse({ receiptIds: ids, reasonCode: 'other' }).success).toBe(false);
    expect(cancelSchema.safeParse({ receiptIds: ids, reasonCode: 'other', note: ' a ' }).success).toBe(false);
    expect(cancelSchema.safeParse({ receiptIds: ids, reasonCode: 'other', note: 'Devotee left' }).success).toBe(true);
    expect(cancelSchema.safeParse({ receiptIds: ids, reasonCode: 'wrong_date' }).success).toBe(true);
  });

  it('refuses the system cancel codes from clients', () => {
    const ids = [randomUUID()];
    expect(cancelSchema.safeParse({ receiptIds: ids, reasonCode: 'refunded' }).success).toBe(false);
    expect(cancelSchema.safeParse({ receiptIds: ids, reasonCode: 'not_printed_connection_lost' }).success).toBe(false);
  });

  it('takes 1..31 receipt ids', () => {
    expect(cancelSchema.safeParse({ receiptIds: [], reasonCode: 'wrong_seva' }).success).toBe(false);
    const many = Array.from({ length: 32 }, () => randomUUID());
    expect(cancelSchema.safeParse({ receiptIds: many, reasonCode: 'wrong_seva' }).success).toBe(false);
  });
});

describe('other request schemas', () => {
  it('prasadam give needs a receipt id and the off-date flag', () => {
    expect(prasadamGiveSchema.safeParse({ receiptId: randomUUID(), confirmOffDate: false }).success).toBe(true);
    expect(prasadamGiveSchema.safeParse({ receiptId: 'x', confirmOffDate: false }).success).toBe(false);
  });

  it('day close takes counts and a note', () => {
    const ok = {
      counterId: 1,
      businessDate: '2026-10-20',
      counts: [{ kind: 'note', valuePaise: 50000, count: 3 }],
      upiBankTotalPaise: null,
      note: '',
    };
    expect(dayCloseSchema.safeParse(ok).success).toBe(true);
    expect(dayCloseSchema.safeParse({ ...ok, counts: [{ kind: 'note', valuePaise: 50000, count: -1 }] }).success).toBe(
      false,
    );
  });

  it('denominations refuse a value above Rs 2,000 or an unknown kind', () => {
    const row = { kind: 'note', valuePaise: 50000, displayOrder: 1, shown: true };
    expect(denominationsSchema.safeParse({ items: [row] }).success).toBe(true);
    expect(denominationsSchema.safeParse({ items: [{ ...row, valuePaise: 200001 }] }).success).toBe(false);
    expect(denominationsSchema.safeParse({ items: [{ ...row, kind: 'card' }] }).success).toBe(false);
  });

  it('a seva needs a 2-3 letter code and any-amount only on the counter', () => {
    const seva = {
      code: 'PA',
      nameEn: 'Paaduka Pooja',
      nameKn: null,
      ratePaise: 50500,
      anyAmount: false,
      visibility: 'both',
      multiDate: false,
      allowAmountChange: true,
      prasadamGiven: true,
      prasadamItems: null,
      category: 'pooja',
      incomeLedger: null,
      active: true,
    };
    expect(sevaUpsertSchema.safeParse(seva).success).toBe(true);
    expect(sevaUpsertSchema.safeParse({ ...seva, code: 'pa1' }).success).toBe(false);
    expect(sevaUpsertSchema.safeParse({ ...seva, anyAmount: true, ratePaise: null }).success).toBe(false);
    expect(
      sevaUpsertSchema.safeParse({ ...seva, anyAmount: true, ratePaise: null, visibility: 'counter' }).success,
    ).toBe(true);
  });

  it('staff deactivation and gap resolution need a reason', () => {
    expect(staffUpdateSchema.safeParse({ status: 'inactive' }).success).toBe(false);
    expect(staffUpdateSchema.safeParse({ status: 'inactive', reason: 'Left the temple' }).success).toBe(true);
    expect(gapResolveSchema.safeParse({ status: 'declared_lost', note: '' }).success).toBe(false);
    expect(gapResolveSchema.safeParse({ status: 'declared_lost', note: 'PC died' }).success).toBe(true);
  });

  it('export audit takes a format, a range and parts', () => {
    expect(
      exportAuditSchema.safeParse({
        format: 'xlsx',
        from: '2026-10-01',
        to: '2026-10-31',
        parts: ['receipts'],
        includePhones: false,
      }).success,
    ).toBe(true);
    expect(
      exportAuditSchema.safeParse({ format: 'pdf', from: '2026-10-01', to: '2026-10-31', parts: [], includePhones: false })
        .success,
    ).toBe(false);
  });
});
