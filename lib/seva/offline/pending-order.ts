/**
 * The client ids of the order on the counter screen (Design Book 8.6, C-53; review H-3).
 *
 * - The same order keeps its client order id, client receipt ids and QR tokens across retries, so the office returns
 *   the stored order if an earlier attempt got through.
 * - A changed order normally gets new ids.
 * - An order is "in doubt" once the office did not answer three attempts and the receptionist chose not to print
 *   offline: the office may already hold it. From then on, even an edited order keeps its client order id. Its next
 *   online save therefore checks with the office first: the office returns the first order if it has it, and stores
 *   the edited one under that id only if it does not. An offline save names it in `supersedesClientOrderId`.
 */
export interface OrderIds {
  clientOrderId: string;
  clientReceiptIds: string[];
  qrTokens: string[];
}

export interface PendingOrder {
  /** The order as it would be sent, without its ids. */
  key: string;
  ids: OrderIds;
  /** The office may hold this client order id already. */
  inDoubt: boolean;
  /** The order as it was when it went in doubt; set only while in doubt. */
  inDoubtKey?: string;
}

export interface IdMaker {
  id(): string;
  qrToken(): string;
}

function fill(kept: readonly string[], count: number, make: () => string): string[] {
  return Array.from({ length: count }, (_, i) => kept[i] ?? make());
}

/** The ids to send for the order `key` with `receiptCount` receipts, given what is pending on the screen. */
export function orderIdsFor(pending: PendingOrder | null, key: string, receiptCount: number, make: IdMaker): PendingOrder {
  if (pending && pending.key === key && pending.ids.clientReceiptIds.length === receiptCount) return pending;
  if (pending?.inDoubt) {
    return {
      key,
      inDoubt: true,
      inDoubtKey: pending.inDoubtKey ?? pending.key,
      ids: {
        clientOrderId: pending.ids.clientOrderId,
        clientReceiptIds: fill(pending.ids.clientReceiptIds, receiptCount, make.id),
        qrTokens: fill(pending.ids.qrTokens, receiptCount, make.qrToken),
      },
    };
  }
  return {
    key,
    inDoubt: false,
    ids: {
      clientOrderId: make.id(),
      clientReceiptIds: fill([], receiptCount, make.id),
      qrTokens: fill([], receiptCount, make.qrToken),
    },
  };
}

/** The office did not answer and nothing was printed: keep the ids, and remember the order as it was then. */
export function markInDoubt(pending: PendingOrder, key: string): PendingOrder {
  return { ...pending, inDoubt: true, inDoubtKey: pending.inDoubtKey ?? key };
}

/** True when the order on the screen was edited after it went in doubt. */
export function editedSinceInDoubt(pending: PendingOrder | null): boolean {
  return pending !== null && pending.inDoubt && pending.inDoubtKey !== undefined && pending.inDoubtKey !== pending.key;
}
