/**
 * Seva error codes shared by the SQL functions (`RAISE EXCEPTION 'SEVA:<code>'`), the routes
 * (`{ error: { code, message } }` with the code's HTTP status) and the browser. Messages are plain English and never
 * carry stack text or personal data.
 */
export const SEVA_ERROR_CODES = [
  'unauthenticated',
  'forbidden',
  'view_only',
  'staff_inactive',
  'device_required',
  'device_unknown',
  'validation',
  'seva_inactive',
  'seva_not_on_counter',
  'price_changed',
  'amount_change_not_allowed',
  'change_reason_required',
  'date_out_of_range',
  'cash_short',
  'upi_details_required',
  'cancel_window_passed',
  'already_cancelled',
  'cannot_reprint_cancelled',
  'outbox_not_empty',
  'day_already_closed',
  'day_closed',
  'difference_note_required',
  'number_conflict',
  'device_exists',
  'not_found',
  'rate_limited',
  'partial_failure',
  'internal',
] as const;

export type SevaErrorCode = (typeof SEVA_ERROR_CODES)[number];

export class SevaError extends Error {
  constructor(
    public code: SevaErrorCode,
    public detail?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'SevaError';
  }
}

export function isSevaErrorCode(value: unknown): value is SevaErrorCode {
  return typeof value === 'string' && (SEVA_ERROR_CODES as readonly string[]).includes(value);
}

const STATUS: Record<SevaErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  view_only: 403,
  staff_inactive: 403,
  device_required: 403,
  device_unknown: 403,
  validation: 400,
  seva_inactive: 409,
  seva_not_on_counter: 409,
  price_changed: 409,
  amount_change_not_allowed: 409,
  change_reason_required: 400,
  date_out_of_range: 400,
  cash_short: 400,
  upi_details_required: 400,
  cancel_window_passed: 403,
  already_cancelled: 409,
  cannot_reprint_cancelled: 409,
  outbox_not_empty: 409,
  day_already_closed: 409,
  day_closed: 409,
  difference_note_required: 400,
  number_conflict: 409,
  device_exists: 409,
  not_found: 404,
  rate_limited: 429,
  partial_failure: 502,
  internal: 500,
};

export function sevaErrorStatus(code: SevaErrorCode): number {
  return STATUS[code];
}

function text(detail: Record<string, unknown> | undefined, key: string): string | null {
  const value = detail?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

const MESSAGES: Record<SevaErrorCode, (detail?: Record<string, unknown>) => string> = {
  unauthenticated: () => 'Please sign in again.',
  forbidden: () => 'Your role does not allow this.',
  view_only: () => 'You have view-only access, so you cannot change anything here.',
  staff_inactive: () => 'Your staff account is not active. Ask a temple admin.',
  device_required: () => 'This PC is not registered as a counter. Ask a temple admin to register it.',
  device_unknown: () => 'This PC is no longer registered for this counter. Ask a temple admin to register it again.',
  validation: () => 'Some details are missing or not right. Check the form and try again.',
  seva_inactive: (d) => {
    const name = text(d, 'name');
    return name
      ? `${name} was switched off in Seva settings a moment ago.`
      : 'A seva in this order was switched off in Seva settings a moment ago.';
  },
  seva_not_on_counter: (d) => {
    const name = text(d, 'name');
    return name ? `${name} is not offered at the counter.` : 'A seva in this order is not offered at the counter.';
  },
  price_changed: () => 'The rate changed - check the total.',
  amount_change_not_allowed: (d) => {
    const name = text(d, 'name');
    return name ? `The amount of ${name} cannot be changed.` : 'The amount of this seva cannot be changed.';
  },
  change_reason_required: () => 'Give a reason for the changed amount.',
  date_out_of_range: () => 'The seva date is outside the allowed days. Pick today or a later allowed date.',
  cash_short: () => 'The cash received is less than the total.',
  upi_details_required: () => 'Type the last 6 digits of the UPI reference and tick that you saw the payment succeed.',
  cancel_window_passed: () => 'The time to cancel this receipt has passed. A temple admin can cancel it.',
  already_cancelled: () => 'This receipt is already cancelled.',
  cannot_reprint_cancelled: () => 'A cancelled receipt cannot be printed again.',
  outbox_not_empty: () => 'Some receipts are still waiting to send. Wait until nothing is waiting, then close the day.',
  day_already_closed: () => 'This day is already closed for this counter.',
  day_closed: () => 'The day is closed for this counter. A temple admin can reopen it.',
  difference_note_required: () => 'Write a note that explains the difference.',
  number_conflict: () => 'That receipt number is already used. The office has been told.',
  device_exists: () => 'This counter already has a registered PC. Use "Replace this PC" instead.',
  not_found: () => 'Nothing was found.',
  rate_limited: () => 'Too many tries. Wait a minute and try again.',
  partial_failure: () => 'Only part of this change was saved. Check the details and try again.',
  internal: () => 'Something went wrong on the server. Try again.',
};

export function sevaErrorMessage(code: SevaErrorCode, detail?: Record<string, unknown>): string {
  return MESSAGES[code](detail);
}
