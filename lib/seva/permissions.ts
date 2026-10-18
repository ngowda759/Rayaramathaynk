/**
 * Seva permissions - the role x action matrix of DB §3.3 as one allow-list, shared by the server guard
 * (lib/seva/server/auth.ts, which enforces it) and the browser (which only hides what is not allowed).
 * Pure: no I/O, safe to import on both sides.
 *
 * How the conditional cells read (fail closed):
 * - A condition that limits WHICH record may be touched needs that record's facts in the context; when a fact is
 *   missing the answer is no. Example: a receptionist's reprint needs `counterIdOfDevice`, `receiptCounterId`,
 *   `receiptBusinessDate` and `todayBusinessDate`, and is allowed only when the receipt is on the device's counter
 *   and today. For a day close the "receipt" fields name the counter and the business date being closed; for the
 *   register list (`receipts.list`) they name the counter and date the list is limited to.
 * - The server guard fills `counterIdOfDevice` only from a verified device and `todayBusinessDate` from the server
 *   clock in IST; a route never supplies those two.
 * - View-only (a temple admin's switch, or the flag on anyone) blocks every write and the phone export (C-16).
 * - An unknown action or role is denied.
 */

import type { SevaAction, SevaRole } from "@/types/seva";

export type { SevaAction } from "@/types/seva";

export interface SevaActor {
  staffId: string;
  uid: string;
  role: SevaRole;
  viewOnly: boolean;
  staffNo: number;
  name: string;
}

export interface PermissionContext {
  counterIdOfDevice?: number;
  receiptCounterId?: number;
  receiptBusinessDate?: string;
  todayBusinessDate?: string;
  receiptIssuedByStaffId?: string;
  withinCancelWindow?: boolean;
  targetRole?: SevaRole;
  targetStaffId?: string;
  newRole?: SevaRole;
}

type Who = Pick<SevaActor, "role" | "viewOnly" | "staffId">;

/** The columns of DB §3.3: Receptionist, Prasadam counter, Temple admin, Temple admin view-only, Super admin. */
type Column = "R" | "P" | "TA" | "TV" | "SA";

interface Rule {
  /** Who may do it at all. */
  columns: readonly Column[];
  /** Changes data; view-only people never may. */
  write: boolean;
  /** A read that view-only people may not do either (phone numbers, C-16). */
  notForViewOnly?: true;
  /** Extra limits, checked after the column; receives the actor's column. */
  when?: (who: Who, ctx: PermissionContext, column: Column) => boolean;
}

const COUNTER: readonly Column[] = ["R", "TA", "SA"];
const PRASADAM: readonly Column[] = ["P", "TA", "SA"];
const ADMIN: readonly Column[] = ["TA", "SA"];
const ADMIN_AND_VIEW: readonly Column[] = ["TA", "TV", "SA"];
const SUPER: readonly Column[] = ["SA"];

/** The roles a temple admin may hand out or change (C-17); super admin is never one of them. */
const BELOW_SUPER_ADMIN: ReadonlySet<SevaRole> = new Set<SevaRole>(["receptionist", "prasadam_counter", "temple_admin"]);

function present(value: string | undefined): value is string {
  return typeof value === "string" && value !== "";
}

/** The record is on the device's own counter and on today's business date. */
function onOwnCounterToday(ctx: PermissionContext): boolean {
  return (
    Number.isInteger(ctx.counterIdOfDevice) &&
    ctx.receiptCounterId === ctx.counterIdOfDevice &&
    present(ctx.todayBusinessDate) &&
    ctx.receiptBusinessDate === ctx.todayBusinessDate
  );
}

/** DB §3.3 rows 5, 6 and 11 (C-59): receptionists only on their own counter, today. */
function receptionistOwnCounterToday(_who: Who, ctx: PermissionContext, column: Column): boolean {
  return column !== "R" || onOwnCounterToday(ctx);
}

/** DB §3.3 row 3: the person's own receipt, inside the cancel window. */
function ownReceiptInWindow(who: Who, ctx: PermissionContext): boolean {
  return present(ctx.receiptIssuedByStaffId) && ctx.receiptIssuedByStaffId === who.staffId && ctx.withinCancelWindow === true;
}

/** DB §3.3 row 18: a temple admin onboards as Receptionist, Prasadam counter or Temple admin only. */
function onboardWithinReach(_who: Who, ctx: PermissionContext, column: Column): boolean {
  return column === "SA" || (ctx.newRole !== undefined && BELOW_SUPER_ADMIN.has(ctx.newRole));
}

/** DB §3.3 row 20 (C-17): a temple admin changes another person below super admin, never to super admin. */
function roleChangeWithinReach(who: Who, ctx: PermissionContext, column: Column): boolean {
  if (column === "SA") return true;
  return (
    present(ctx.targetStaffId) &&
    ctx.targetStaffId !== who.staffId &&
    ctx.targetRole !== undefined &&
    BELOW_SUPER_ADMIN.has(ctx.targetRole) &&
    (ctx.newRole === undefined || BELOW_SUPER_ADMIN.has(ctx.newRole))
  );
}

/** One entry per action; `Record` makes the compiler insist every SevaAction is listed. */
const RULES: Record<SevaAction, Rule> = {
  // DB §3.3 rows 1-26
  "counter.issue": { columns: COUNTER, write: true },
  "counter.change_amount": { columns: COUNTER, write: true },
  "receipt.cancel_own": { columns: COUNTER, write: true, when: ownReceiptInWindow },
  "receipt.cancel_any": { columns: ADMIN, write: true },
  "receipt.reprint": { columns: COUNTER, write: true, when: receptionistOwnCounterToday },
  "dayclose.close": { columns: COUNTER, write: true, when: receptionistOwnCounterToday },
  "dayclose.reopen": { columns: ADMIN, write: true },
  "prasadam.give": { columns: PRASADAM, write: true },
  "prasadam.give_off_date": { columns: PRASADAM, write: true },
  "prasadam.reverse": { columns: ADMIN, write: true },
  "reports.view": { columns: ADMIN_AND_VIEW, write: false },
  "export.basic": { columns: ADMIN_AND_VIEW, write: false },
  "export.with_phones": { columns: ADMIN, write: false, notForViewOnly: true },
  "sevas.edit": { columns: ADMIN, write: true },
  "settings.edit": { columns: ADMIN, write: true },
  "device.register": { columns: ADMIN, write: true },
  "gap.resolve": { columns: ADMIN, write: true },
  "staff.onboard": { columns: ADMIN, write: true, when: onboardWithinReach },
  "staff.grant_super_admin": { columns: SUPER, write: true },
  "staff.change_role": { columns: ADMIN, write: true, when: roleChangeWithinReach },
  "staff.reactivate": { columns: ADMIN, write: true },
  "staff.deactivate": { columns: SUPER, write: true },
  "staff.delete": { columns: SUPER, write: true },
  "payments.view": { columns: ADMIN_AND_VIEW, write: false },
  "payments.refund": { columns: ADMIN, write: true },
  "payments.fee_rule": { columns: SUPER, write: true },
  // Read and housekeeping actions outside the matrix (DB §6.5 "Who" column)
  "receipts.list": { columns: ["R", "TA", "TV", "SA"], write: false, when: receptionistOwnCounterToday },
  "sevas.read": { columns: ["R", "TA", "TV", "SA"], write: false },
  "devotees.search": { columns: COUNTER, write: false },
  "counter.heartbeat": { columns: COUNTER, write: true },
  me: { columns: ["R", "P", "TA", "TV", "SA"], write: false },
};

/** Every action, in matrix order. */
export const SEVA_ACTIONS: readonly SevaAction[] = Object.keys(RULES) as SevaAction[];

function ruleFor(action: SevaAction): Rule | undefined {
  return Object.prototype.hasOwnProperty.call(RULES, action) ? RULES[action] : undefined;
}

function columnOf(who: Who): Column | null {
  switch (who.role) {
    case "receptionist":
      return "R";
    case "prasadam_counter":
      return "P";
    case "temple_admin":
      return who.viewOnly === false ? "TA" : "TV";
    case "super_admin":
      return "SA";
    default:
      return null;
  }
}

export function can(actor: Who, action: SevaAction, ctx?: PermissionContext): boolean {
  const rule = ruleFor(action);
  const column = columnOf(actor);
  if (!rule || !column || !rule.columns.includes(column)) return false;
  // Anything but an explicit `false` counts as view-only.
  if (actor.viewOnly !== false && (rule.write || rule.notForViewOnly)) return false;
  return rule.when ? rule.when(actor, ctx ?? {}, column) : true;
}

/** True when the action changes data (view-only blocks it). Unknown actions count as writes. */
export function isWriteAction(action: SevaAction): boolean {
  return ruleFor(action)?.write ?? true;
}

const FIRESTORE_ROLES: ReadonlyMap<string, SevaRole> = new Map<string, SevaRole>([
  ["receptionist", "receptionist"],
  ["prasadam_counter", "prasadam_counter"],
  ["temple_admin", "temple_admin"],
  ["admin", "temple_admin"],
  ["super_admin", "super_admin"],
]);

/**
 * The Firestore `users.role` value to a seva role (C-62). Spelling is normalised the way the admin console's server
 * allow-list does it (trim, lower case, spaces to `_`), so 'Temple Admin' reads as temple_admin. Legacy `admin` is a
 * temple admin; `billing`, `priest`, `staff`, `office_staff`, devotees, blanks, misspellings and non-strings get null.
 */
export function mapFirestoreRole(raw: unknown): SevaRole | null {
  if (typeof raw !== "string") return null;
  return FIRESTORE_ROLES.get(raw.trim().toLowerCase().replace(/\s+/g, "_")) ?? null;
}
