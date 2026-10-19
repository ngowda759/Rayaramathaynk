/**
 * @jest-environment node
 */
import { markInDoubt, orderIdsFor, type PendingOrder } from '@/lib/seva/offline/pending-order';

function maker() {
  let n = 0;
  return {
    id: () => `id-${++n}`,
    qrToken: () => `qr-${++n}`,
  };
}

describe('pending order ids (H-3)', () => {
  it('the same order keeps its ids; a changed order gets new ones', () => {
    const make = maker();
    const first = orderIdsFor(null, 'A', 2, make);
    expect(orderIdsFor(first, 'A', 2, make)).toBe(first);

    const changed = orderIdsFor(first, 'B', 2, make);
    expect(changed.ids.clientOrderId).not.toBe(first.ids.clientOrderId);
    expect(changed.inDoubt).toBe(false);
  });

  it('after an in-doubt "No", an edited order keeps its client order id, so the office is asked about the first one', () => {
    const make = maker();
    const first = markInDoubt(orderIdsFor(null, 'A', 2, make), 'A');

    const edited = orderIdsFor(first, 'B', 3, make);

    expect(edited.inDoubt).toBe(true);
    expect(edited.inDoubtKey).toBe('A');
    expect(edited.key).toBe('B');
    expect(edited.ids.clientOrderId).toBe(first.ids.clientOrderId);
    expect(edited.ids.clientReceiptIds.slice(0, 2)).toEqual(first.ids.clientReceiptIds);
    expect(edited.ids.clientReceiptIds).toHaveLength(3);
    expect(edited.ids.qrTokens).toHaveLength(3);
    expect(new Set(edited.ids.clientReceiptIds).size).toBe(3);

    const fewer = orderIdsFor(edited, 'C', 1, make);
    expect(fewer.ids.clientOrderId).toBe(first.ids.clientOrderId);
    expect(fewer.ids.clientReceiptIds).toEqual([first.ids.clientReceiptIds[0]]);
  });

  it('an in-doubt order is edited only when its key changed', () => {
    const make = maker();
    const pending: PendingOrder = markInDoubt(orderIdsFor(null, 'A', 1, make), 'A');
    expect(pending.inDoubtKey).toBe('A');
    expect(orderIdsFor(pending, 'A', 1, make)).toBe(pending);
  });
});
