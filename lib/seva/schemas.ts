/**
 * Zod schemas for every Seva Entry request body. Client and server share them (DB §9.7); the SQL functions re-check
 * everything that depends on the database (catalogue, prices, dates in range, numbers).
 * Field rules come from the DB §7 checks and §13. Pure: imports nothing from other seva modules that run in parallel.
 */
import { z } from 'zod';
import type {
  CancelReasonCode,
  CounterOrderPayload,
  OfflineOrderPayload,
  OutboxItem,
  SevaRole,
} from '@/types/seva';
import { NAKSHATRAS } from './domain/nakshatras';
import { RASHIS } from './domain/rashis';

// ---------------------------------------------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------------------------------------------

/** Ids the browser makes with crypto.randomUUID() (RFC 4122 v4). */
const clientId = z.uuid();
/** Ids the database made; any 8-4-4-4-12 hex form so fixed seed ids are accepted too. */
const dbId = z.guid();

/** Same literal as isQrToken in lib/seva/qr.ts: 22-char base64url of 16 random bytes (DB §10.3). */
const QR_TOKEN = /^[A-Za-z0-9_-]{22}$/;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-20')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, 'Use a real calendar date');

const isoDateTime = z.iso.datetime({ offset: true });

/** Character count as Postgres length() counts it (code points), not UTF-16 units. */
function chars(value: string): number {
  return Array.from(value).length;
}

function boundedText(min: number, max: number) {
  return z
    .string()
    .trim()
    .refine((v) => chars(v) >= min, min <= 1 ? 'This is required' : `Write at least ${min} characters`)
    .refine((v) => chars(v) <= max, `Keep this to ${max} characters or fewer`);
}

const paise = z.number().int().nonnegative();
const positivePaise = z.number().int().positive();

const PHONE_MESSAGE = 'Enter a 10-digit mobile number';

/**
 * Indian mobile number, normalised to +91XXXXXXXXXX (C-31). Accepts spaces, hyphens and brackets, and a +91, 91 or 0
 * prefix. A blank value means "not given".
 */
const phone = z
  .string()
  .transform((raw, ctx) => {
    const compact = raw.replace(/[\s\-().]/g, '');
    if (compact.length === 0) return undefined;
    const match = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(compact);
    if (!match) {
      ctx.addIssue({ code: 'custom', message: PHONE_MESSAGE, params: { code: 'invalid_phone' } });
      return z.NEVER;
    }
    return `+91${match[1]}`;
  })
  .optional();

// ---------------------------------------------------------------------------------------------------------------
// Devotee and counter orders
// ---------------------------------------------------------------------------------------------------------------

/**
 * Gotra ids as the receipts store them (smallint, 0 up): the built-in 0-56 and the gotras temple admins add from 1000
 * (plan A4P-5, seva_list_items). The text is always stored too, so an id the office does not know is never lost.
 */
const MAX_GOTRA_ID = 32767;

export const devoteeSchema = z.object({
  name: boundedText(1, 80),
  gotra: z
    .object({
      text: boundedText(1, 60),
      id: z.number().int().min(0).max(MAX_GOTRA_ID).optional(),
    })
    .optional(),
  nakshatra: z
    .object({
      id: z.number().int().min(1).max(NAKSHATRAS.length).optional(),
      text: boundedText(1, 60).optional(),
    })
    .optional(),
  rashi: z
    .object({
      id: z.number().int().min(1).max(RASHIS.length).optional(),
      text: boundedText(1, 60).optional(),
    })
    .optional(),
  phone,
});

const counterLineSchema = z.object({
  sevaId: dbId,
  quantity: z.number().int().min(1).max(99),
  unitRatePaise: positivePaise.optional(),
  changeReason: boundedText(1, 200).optional(),
});

const counterReceiptSchema = z.object({
  clientReceiptId: clientId,
  sevaDate: isoDate,
  qrToken: z.string().regex(QR_TOKEN, 'Bad QR token'),
  lines: z.array(counterLineSchema).min(1).max(8),
});

const paymentSchema = z
  .object({
    mode: z.enum(['cash', 'upi']),
    cashReceivedPaise: paise.optional(),
    upiRefLast6: z.string().regex(/^\d{6}$/, 'Type the last 6 digits of the UPI reference').optional(),
    upiSeenConfirmed: z.boolean().optional(),
  })
  .superRefine((p, ctx) => {
    if (p.mode !== 'upi') return;
    if (p.upiRefLast6 === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['upiRefLast6'],
        message: 'Type the last 6 digits of the UPI reference',
        params: { code: 'upi_details_required' },
      });
    }
    if (p.upiSeenConfirmed !== true) {
      ctx.addIssue({
        code: 'custom',
        path: ['upiSeenConfirmed'],
        message: 'Tick that you saw the payment succeed',
        params: { code: 'upi_details_required' },
      });
    }
  });

const orderBase = {
  clientOrderId: clientId,
  devotee: devoteeSchema,
  payment: paymentSchema,
  expectedTotalPaise: positivePaise,
  supersedesClientOrderId: clientId.optional(),
};

function checkCashCovers(
  o: { payment: { mode: string; cashReceivedPaise?: number }; expectedTotalPaise: number },
  ctx: z.RefinementCtx,
): void {
  if (o.payment.mode === 'cash' && o.payment.cashReceivedPaise !== undefined && o.payment.cashReceivedPaise < o.expectedTotalPaise) {
    ctx.addIssue({
      code: 'custom',
      path: ['payment', 'cashReceivedPaise'],
      message: 'The cash received is less than the total',
      params: { code: 'cash_short' },
    });
  }
}

export const counterOrderSchema = z
  .object({ ...orderBase, receipts: z.array(counterReceiptSchema).min(1).max(31) })
  .superRefine(checkCashCovers) satisfies z.ZodType<CounterOrderPayload>;

const offlineReceiptSchema = counterReceiptSchema.extend({
  runningNo: z.number().int().min(1).max(999999),
  /** The SQL function checks it against its parts. */
  receiptNo: z.string().min(1).max(40),
  lines: z
    .array(counterLineSchema.extend({ cachedRatePaise: positivePaise.nullable() }))
    .min(1)
    .max(8),
});

export const offlineOrderSchema = z
  .object({
    ...orderBase,
    /** The issuer, whose staff no. is inside every receipt number (the SQL function checks both). */
    issuerStaffNo: z.number().int().min(1).max(999),
    issuedAt: isoDateTime,
    groupNo: z.string().trim().min(1).max(20),
    receipts: z.array(offlineReceiptSchema).min(1).max(31),
  })
  .superRefine(checkCashCovers) satisfies z.ZodType<OfflineOrderPayload>;

// ---------------------------------------------------------------------------------------------------------------
// Cancel and sync
// ---------------------------------------------------------------------------------------------------------------

/** Reasons a person may choose (DB §9.9). 'not_printed_connection_lost' and 'refunded' are set by the system only. */
export const CLIENT_CANCEL_REASONS = [
  'wrong_seva',
  'wrong_date',
  'wrong_amount',
  'wrong_devotee',
  'changed_mind',
  'entered_twice',
  'spoiled_print',
  'other',
] as const satisfies readonly CancelReasonCode[];

const clientCancelReason = z.enum(CLIENT_CANCEL_REASONS);
const cancelNote = z.string().trim().max(500).optional();

function checkOtherNeedsNote(c: { reasonCode: string; note?: string }, ctx: z.RefinementCtx): void {
  if (c.reasonCode === 'other' && chars(c.note ?? '') < 3) {
    ctx.addIssue({
      code: 'custom',
      path: ['note'],
      message: 'Write a short note (at least 3 characters) for "Other"',
    });
  }
}

export const cancelSchema = z
  .object({
    receiptIds: z.array(dbId).min(1).max(31),
    reasonCode: clientCancelReason,
    note: cancelNote,
  })
  .superRefine(checkOtherNeedsNote);

const outboxOrderSchema = z.object({
  seq: z.number().int().positive(),
  kind: z.literal('order'),
  payload: offlineOrderSchema,
});

const outboxCancelSchema = z
  .object({
    seq: z.number().int().positive(),
    kind: z.literal('cancel'),
    clientReceiptIds: z.array(clientId).min(1).max(31),
    reasonCode: clientCancelReason,
    note: cancelNote,
    at: isoDateTime,
    /** Who cancelled on the PC; the SQL function checks them as it checks an offline issuer. */
    cancelledByStaffNo: z.number().int().min(1).max(999),
  })
  .superRefine(checkOtherNeedsNote);

export const syncRequestSchema = z.object({
  items: z.array(z.discriminatedUnion('kind', [outboxOrderSchema, outboxCancelSchema])).min(1).max(200),
}) satisfies z.ZodType<{ items: OutboxItem[] }>;

// ---------------------------------------------------------------------------------------------------------------
// Prasadam and day close
// ---------------------------------------------------------------------------------------------------------------

export const prasadamGiveSchema = z.object({
  receiptId: dbId,
  confirmOffDate: z.boolean(),
});

export const prasadamUndoSchema = z.object({
  receiptId: dbId,
  /** Required by the SQL function when a temple admin reverses after the undo window. */
  reason: z.string().trim().max(200).optional(),
});

const counterId = z.number().int().min(1).max(99);
const denominationKind = z.enum(['note', 'coin']);
/** Rs 0.01 .. Rs 2,000 (DB §7.2 cash_denominations.value). */
const denominationValuePaise = z.number().int().min(1).max(200000);

export const dayCloseSchema = z.object({
  counterId,
  businessDate: isoDate,
  counts: z
    .array(
      z.object({
        kind: denominationKind,
        valuePaise: denominationValuePaise,
        count: z.number().int().min(0).max(100000),
      }),
    )
    .max(40),
  upiBankTotalPaise: paise.nullable().optional(),
  /** Required (>= 3 characters) by the SQL function when cash or UPI differs (difference_note_required). */
  note: z.string().trim().max(1000).optional(),
});

// ---------------------------------------------------------------------------------------------------------------
// Catalogue and settings (DB §7.1, §7.2, §13)
// ---------------------------------------------------------------------------------------------------------------

export const sevaUpsertSchema = z
  .object({
    id: dbId.optional(),
    code: z.string().regex(/^[A-Z]{2,3}$/, 'Use 2 or 3 capital letters').nullable(),
    key: z.number().int().min(1).max(999).optional(),
    nameEn: boundedText(1, 80),
    nameKn: boundedText(1, 80).nullable(),
    ratePaise: positivePaise.nullable(),
    anyAmount: z.boolean(),
    visibility: z.enum(['counter', 'online', 'both']),
    multiDate: z.boolean(),
    allowAmountChange: z.boolean(),
    prasadamGiven: z.boolean(),
    prasadamItems: boundedText(1, 200).nullable(),
    category: boundedText(1, 60),
    incomeLedger: boundedText(1, 100).nullable(),
    active: z.boolean(),
    /**
     * Why the rate changed. The SQL function requires at least 3 characters when the rate of an existing seva changes
     * (SEVA:change_reason_required); it is listed here so zod does not drop it on the way to the route.
     */
    reason: z.string().trim().max(200, 'Keep this to 200 characters or fewer').optional(),
  })
  .superRefine((s, ctx) => {
    if (s.anyAmount && s.visibility !== 'counter') {
      ctx.addIssue({ code: 'custom', path: ['visibility'], message: 'An any-amount seva is shown on the counter only' });
    }
    if (s.anyAmount && s.ratePaise !== null) {
      ctx.addIssue({ code: 'custom', path: ['ratePaise'], message: 'An any-amount seva has no fixed rate' });
    }
    if (!s.anyAmount && s.ratePaise === null) {
      ctx.addIssue({ code: 'custom', path: ['ratePaise'], message: 'Enter the rate' });
    }
  });

const optionalUrl = z.url().max(1000).nullable();
const ledgerName = boundedText(1, 100);

/**
 * A partial settings update. Strict: a key it does not list is refused, not dropped. The two switches
 * `cash_difference_note_required` and `amount_change_reason_required` are deliberately absent - the owner decided both
 * are always required and the table checks enforce it - so a patch naming either is refused.
 */
export const settingsPatchSchema = z
  .strictObject({
    templeNameEn: boundedText(1, 120),
    templeNameKn: boundedText(1, 120),
    addressLine1: boundedText(0, 120),
    addressLine2: boundedText(0, 120),
    registrationLine: boundedText(1, 120).nullable(),
    photoLeftUrl: optionalUrl,
    photoRightUrl: optionalUrl,
    footerLine1: boundedText(0, 120),
    footerLine2: boundedText(0, 120),
    footerBlessing: boundedText(0, 120),
    printGotra: z.boolean(),
    printNakshatra: z.boolean(),
    printRashi: z.boolean(),
    cancelWindowMinutes: z.number().int().min(0).max(240),
    counterDaysAhead: z.number().int().min(0).max(999),
    onlineDaysAhead: z.number().int().min(0).max(999),
    onlineSameDayCutoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 12:00'),
    prasadamUndoSeconds: z.number().int().min(0).max(3600),
    dayCloseFlagThresholdPaise: paise,
    tallyCashLedger: ledgerName,
    tallyUpiLedger: ledgerName,
    tallyOnlineLedger: ledgerName,
    tallyColumns: z.record(z.string().max(40), z.string().trim().max(60)).nullable(),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Nothing to save');

export const denominationsSchema = z
  .object({
    items: z
      .array(
        z.object({
          kind: denominationKind,
          valuePaise: denominationValuePaise,
          displayOrder: z.number().int().min(1).max(99),
          shown: z.boolean(),
        }),
      )
      .min(1)
      .max(40),
  })
  .superRefine((d, ctx) => {
    const seen = new Set<string>();
    d.items.forEach((item, index) => {
      const key = `${item.kind}:${item.valuePaise}`;
      if (seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['items', index], message: 'This note or coin is listed twice' });
      }
      seen.add(key);
    });
  });

export const festivalSchema = z.object({
  id: dbId.optional(),
  nameEn: boundedText(1, 80),
  nameKn: boundedText(1, 80).nullable(),
  active: z.boolean(),
  dates: z
    .array(isoDate)
    .min(1)
    .max(60)
    .refine((dates) => new Set(dates).size === dates.length, 'A date is listed twice'),
});

/**
 * Settings - Devotee lists (plan A4P-5): one save. A gotra is added (no id, English name needed) or changed (English or
 * Kannada name, hidden or shown); a nakshatra or rashi only gets its Kannada spelling corrected. The SQL function
 * re-checks all of it, refuses a duplicate English gotra name and marks a saved Kannada name checked.
 */
const listName = boundedText(1, 60);

export const listItemSaveSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('gotra'),
      id: z.number().int().min(0).max(MAX_GOTRA_ID).optional(),
      nameEn: listName.optional(),
      nameKn: listName.optional(),
      active: z.boolean().optional(),
    })
    .strict()
    .refine((g) => g.id !== undefined || g.nameEn !== undefined, { path: ['nameEn'], message: 'Write the English name' })
    .refine((g) => g.id === undefined || g.nameEn !== undefined || g.nameKn !== undefined || g.active !== undefined, {
      path: ['id'],
      message: 'Nothing to change',
    }),
  z.object({ kind: z.literal('nakshatra'), id: z.number().int().min(1).max(NAKSHATRAS.length), nameKn: listName }).strict(),
  z.object({ kind: z.literal('rashi'), id: z.number().int().min(1).max(RASHIS.length), nameKn: listName }).strict(),
]);

export const counterSchema = z.object({
  name: boundedText(1, 40),
  place: boundedText(1, 60).nullable(),
  openingFloatPaise: paise,
  active: z.boolean(),
});

const secretHash = z.string().regex(/^[0-9a-f]{64}$/, 'Expected a SHA-256 hex hash');

export const deviceRegisterSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('register'),
    counterId,
    secretHash,
    label: boundedText(0, 120),
  }),
  z.object({
    action: z.literal('replace'),
    counterId,
    secretHash,
    label: boundedText(0, 120),
    lastPrintedOfNo: z.number().int().min(0).max(999999),
    reason: boundedText(3, 200),
  }),
]);

// ---------------------------------------------------------------------------------------------------------------
// Staff, gaps and exports (DB §3.4, §8.5, §12.6, §13.6)
// ---------------------------------------------------------------------------------------------------------------

const sevaRole = z.enum(['receptionist', 'prasadam_counter', 'temple_admin', 'super_admin'] as const satisfies readonly SevaRole[]);

export const staffOnboardSchema = z
  .object({
    fullName: boundedText(1, 80),
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
    role: sevaRole,
    viewOnly: z.boolean(),
    staffNo: z.number().int().min(1).max(999).optional(),
  })
  .superRefine((s, ctx) => {
    if (s.viewOnly && s.role !== 'temple_admin') {
      ctx.addIssue({ code: 'custom', path: ['viewOnly'], message: 'View-only is for temple admins only' });
    }
  });

export const staffUpdateSchema = z
  .object({
    role: sevaRole.optional(),
    viewOnly: z.boolean().optional(),
    status: z.enum(['active', 'inactive', 'deleted']).optional(),
    reason: z.string().trim().max(200).optional(),
  })
  .superRefine((s, ctx) => {
    if (s.role === undefined && s.viewOnly === undefined && s.status === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Nothing to save' });
    }
    if ((s.status === 'inactive' || s.status === 'deleted') && chars(s.reason ?? '') < 3) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Give a reason (at least 3 characters)' });
    }
  });

export const gapResolveSchema = z.object({
  status: z.enum(['entered_from_paper', 'declared_lost']),
  note: boundedText(3, 500),
});

export const EXPORT_PARTS = ['receipts', 'lines', 'sevas', 'cancelled', 'dayCloses', 'prasadam', 'rateChanges'] as const;

export const exportAuditSchema = z
  .object({
    format: z.enum(['xlsx', 'csv', 'tally', 'print']),
    from: isoDate,
    to: isoDate,
    parts: z.array(z.enum(EXPORT_PARTS)).max(EXPORT_PARTS.length),
    includePhones: z.boolean(),
  })
  .refine((e) => e.from <= e.to, { path: ['to'], message: 'The end date is before the start date' });

// ---------------------------------------------------------------------------------------------------------------
// Inferred types for request bodies that have no wire type in types/seva.ts
// ---------------------------------------------------------------------------------------------------------------

export type CancelRequest = z.infer<typeof cancelSchema>;
export type PrasadamGiveRequest = z.infer<typeof prasadamGiveSchema>;
export type PrasadamUndoRequest = z.infer<typeof prasadamUndoSchema>;
export type DayCloseRequest = z.infer<typeof dayCloseSchema>;
export type SevaUpsert = z.infer<typeof sevaUpsertSchema>;
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
export type DenominationsRequest = z.infer<typeof denominationsSchema>;
export type FestivalRequest = z.infer<typeof festivalSchema>;
export type CounterRequest = z.infer<typeof counterSchema>;
export type ListItemSaveRequest = z.infer<typeof listItemSaveSchema>;
export type DeviceRegisterRequest = z.infer<typeof deviceRegisterSchema>;
export type StaffOnboardRequest = z.infer<typeof staffOnboardSchema>;
export type StaffUpdateRequest = z.infer<typeof staffUpdateSchema>;
export type GapResolveRequest = z.infer<typeof gapResolveSchema>;
export type ExportAuditRequest = z.infer<typeof exportAuditSchema>;
export type ExportPart = (typeof EXPORT_PARTS)[number];
