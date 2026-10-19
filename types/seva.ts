export interface Seva {
  id: string;

  name: string;

  description: string;

  category: string;

  amount: number;

  duration: number;

  imageUrl: string;

  active: boolean;

  displayOrder: number;

  createdAt: string;

  updatedAt: string;
}

export interface SevaRequest {
  name: string;
  description: string;
  category: string;
  amount: number;
  duration: number;
  imageUrl: string;
  active: boolean;
  displayOrder: number;
}

// ---------------------------------------------------------------------------------------------------------------
// Seva Entry wire types (DB §6-§9; plan "Shared contracts"). Types only - no runtime code.
// camelCase, money in integer paise, dates 'YYYY-MM-DD', times ISO-8601 strings.
// The Seva / SevaRequest types above belong to the existing public seva pages and are unchanged.
// Area DTOs live in their own files (types/seva-dayclose.ts, seva-reports.ts, seva-export.ts, seva-prasadam.ts,
// seva-receipts.ts, seva-staff.ts) so parallel tasks never edit this file.
// ---------------------------------------------------------------------------------------------------------------

export type SevaRole = 'receptionist' | 'prasadam_counter' | 'temple_admin' | 'super_admin';

export type PaymentMode = 'cash' | 'upi' | 'online';

// Period ('today' | 'week' | 'month' | 'year') is exported by lib/seva/time.ts; import it from there.

export type CancelReasonCode =
  | 'wrong_seva'
  | 'wrong_date'
  | 'wrong_amount'
  | 'wrong_devotee'
  | 'changed_mind'
  | 'entered_twice'
  | 'spoiled_print'
  | 'other'
  | 'not_printed_connection_lost'
  | 'refunded';

/**
 * One action per row of DB §3.3, plus read actions. lib/seva/permissions.ts owns the rules (`can`) and re-exports this
 * type; it is declared here so SevaMe can name it without types/ importing runtime modules.
 */
export type SevaAction =
  | 'counter.issue'
  | 'counter.change_amount'
  | 'receipt.cancel_own'
  | 'receipt.cancel_any'
  | 'receipt.reprint'
  | 'dayclose.close'
  | 'dayclose.reopen'
  | 'prasadam.give'
  | 'prasadam.give_off_date'
  | 'prasadam.reverse'
  | 'reports.view'
  | 'export.basic'
  | 'export.with_phones'
  | 'sevas.edit'
  | 'settings.edit'
  | 'device.register'
  | 'gap.resolve'
  | 'staff.onboard'
  | 'staff.grant_super_admin'
  | 'staff.change_role'
  | 'staff.reactivate'
  | 'staff.deactivate'
  | 'staff.delete'
  | 'payments.view'
  | 'payments.refund'
  | 'payments.fee_rule'
  | 'receipts.list'
  | 'sevas.read'
  | 'devotees.search'
  | 'counter.heartbeat'
  | 'me';

export interface CatalogueSeva {
  id: string;
  code: string | null;
  key: number;
  nameEn: string;
  nameKn: string | null;
  /** null = any amount (Other Seva / Karnike). */
  ratePaise: number | null;
  multiDate: boolean;
  allowAmountChange: boolean;
  prasadamGiven: boolean;
  prasadamItems: string | null;
  visibility: 'counter' | 'online' | 'both';
  active: boolean;
  category: string;
  incomeLedger: string | null;
}

export interface DevoteeInput {
  name: string;
  gotra?: { text: string; id?: number };
  nakshatra?: { id?: number; text?: string };
  rashi?: { id?: number; text?: string };
  /** Normalised +91XXXXXXXXXX. */
  phone?: string;
}

export interface CounterLineInput {
  sevaId: string;
  quantity: number;
  /** Only when changed or for an any-amount seva. */
  unitRatePaise?: number;
  changeReason?: string;
}

export interface CounterReceiptInput {
  clientReceiptId: string;
  sevaDate: string;
  qrToken: string;
  lines: CounterLineInput[];
}

export interface CounterOrderPayload {
  clientOrderId: string;
  devotee: DevoteeInput;
  receipts: CounterReceiptInput[];
  payment: { mode: 'cash' | 'upi'; cashReceivedPaise?: number; upiRefLast6?: string; upiSeenConfirmed?: boolean };
  expectedTotalPaise: number;
  supersedesClientOrderId?: string;
}

export interface OfflineOrderPayload extends Omit<CounterOrderPayload, 'receipts'> {
  /**
   * Staff no. of the person signed in when the order was made - the one inside every receiptNo. Someone else may be
   * signed in when the outbox is sent; the office records this person as the issuer.
   */
  issuerStaffNo: number;
  issuedAt: string;
  groupNo: string;
  receipts: (Omit<CounterReceiptInput, 'lines'> & {
    runningNo: number;
    receiptNo: string;
    lines: (CounterLineInput & { cachedRatePaise: number | null })[];
  })[];
}

export interface IssuedLine {
  lineNo: number;
  sevaId: string;
  code: string | null;
  nameEn: string;
  nameKn: string | null;
  quantity: number;
  unitRatePaise: number;
  amountPaise: number;
  changed: boolean;
  prasadamItems: string | null;
}

export interface IssuedReceipt {
  /** null until an offline receipt syncs. */
  id: string | null;
  clientReceiptId: string;
  receiptNo: string;
  seriesCode: string;
  sevaDate: string;
  groupNo: string;
  position: number;
  count: number;
  orderTotalPaise: number;
  totalPaise: number;
  lines: IssuedLine[];
  payment: { mode: PaymentMode; upiRefLast6?: string };
  devotee: {
    name: string;
    gotra?: string;
    gotraKn?: string;
    nakshatra?: string;
    nakshatraKn?: string;
    rashi?: string;
    rashiKn?: string;
  };
  qrToken: string;
  issuedAt: string;
  issuedBy: { name: string; staffNo: number | null };
  counterName: string | null;
  channel: 'counter' | 'web' | 'app';
  issuedOffline: boolean;
  status: 'issued' | 'cancelled';
  printCount: number;
  prasadam: 'none' | 'pending' | 'given';
}

export interface IssueResponse {
  orderId: string;
  groupNo: string;
  duplicate: boolean;
  receipts: IssuedReceipt[];
}

export type OutboxItem =
  | { seq: number; kind: 'order'; payload: OfflineOrderPayload }
  | {
      seq: number;
      kind: 'cancel';
      clientReceiptIds: string[];
      reasonCode: CancelReasonCode;
      note?: string;
      /** When the cancel was made on the PC; the cancel window is measured to it. */
      at: string;
      /**
       * Staff no. of the person signed in when the cancel was made. Someone else may be signed in when the outbox is
       * sent; the office records this person as the canceller.
       */
      cancelledByStaffNo: number;
    };

export interface SyncResponse {
  results: {
    seq: number;
    ok: boolean;
    duplicate?: boolean;
    code?: string;
    /**
     * An offline cancel stored although its recorded time falls on a day the counter had already closed: the office
     * sees it in the audit trail; the counter may tell the person the closed day's figures changed.
     */
    inClosedDay?: boolean;
  }[];
}

export interface SlipSettings {
  templeNameEn: string;
  templeNameKn: string;
  addressLine1: string;
  addressLine2: string;
  registrationLine: string | null;
  photoLeftUrl: string | null;
  photoRightUrl: string | null;
  footerLine1: string;
  footerLine2: string;
  footerBlessing: string;
  printGotra: boolean;
  printNakshatra: boolean;
  printRashi: boolean;
}

/** The three devotee pick lists temple admins keep (plan A4P-5, table seva_list_items). */
export type SevaListKind = 'gotra' | 'nakshatra' | 'rashi';

/** One gotra, nakshatra or rashi. Ids are those the receipts store (gotra 0-56 built in, 1000 up added). */
export interface SevaListItem {
  id: number;
  nameEn: string;
  /** Null only for an added gotra saved without a Kannada name. */
  nameKn: string | null;
  /** A temple admin has saved (proof-read) this Kannada name (O-03). */
  knChecked: boolean;
  /** False for a hidden gotra: kept for old receipts, not offered at the counter. Nakshatras and rashis are always true. */
  active: boolean;
  displayOrder: number;
}

export interface SevaLists {
  gotras: SevaListItem[];
  nakshatras: SevaListItem[];
  rashis: SevaListItem[];
}

export interface CounterBootstrap {
  counter: { id: number; name: string; onlineSeries: string; offlineSeries: string };
  catalogue: CatalogueSeva[];
  slip: SlipSettings;
  rules: {
    cancelWindowMinutes: number;
    amountChangeReasonRequired: boolean;
    counterDaysAhead: number;
    cashDifferenceNoteRequired: boolean;
  };
  denominations: { kind: 'note' | 'coin'; valuePaise: number }[];
  festivalChips: { name: string; nameKn: string | null; dates: string[] }[];
  nextNumbers: { series: string; nextRunningNo: number }[];
  lastOfNo: number;
  /**
   * The offline group label floor NNN ('G-YYMM-OF1-NNN') for the IST month of `serverTime` - the same floor as the
   * heartbeat's (seva_offline_group_floor), so a PC that has just replaced another never repeats a label.
   */
  lastOfGroupNo: number;
  today: { businessDate: string; receipts: number; cashPaise: number; upiPaise: number; dayClosed: boolean };
  upi: { vpa: string; payeeName: string } | null;
  upiDisabledReason: 'not_configured' | null;
  serverTime: string;
  siteUrl: string;
  /**
   * The gotra, nakshatra and rashi lists as temple admins keep them (plan A4P-5). Absent when the office could not
   * read them, and in a bootstrap this PC cached before the lists existed: the counter then uses the built-in lists.
   */
  lists?: SevaLists;
}

export interface SevaMe {
  staffId: string;
  staffNo: number;
  name: string;
  role: SevaRole;
  viewOnly: boolean;
  actions: SevaAction[];
  /** Set when a live device header came with the call. */
  counter: CounterBootstrap['counter'] | null;
}
