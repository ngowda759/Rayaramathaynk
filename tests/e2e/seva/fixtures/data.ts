/**
 * Demo data for the seva browser tests: the e2e staff, their `me` answers, a small catalogue, settings, a dashboard and
 * report fixtures. Everything here is made up for the emulator project `demo-seva`; nothing reaches a live service.
 * UI tasks that need other data seed it through `createFakeSevaApi(seed)` or add routes with `extend`.
 */
import type { CatalogueSeva, CounterBootstrap, SevaAction, SevaMe, SevaRole, SlipSettings } from "../../../../types/seva";
import type { E2ERole } from "./auth";

export const E2E_COUNTER: CounterBootstrap["counter"] = { id: 1, name: "Counter 1", onlineSeries: "C1", offlineSeries: "OF1" };

export const E2E_SITE_URL = "http://localhost:3100";

export interface E2EStaff {
  staffId: string;
  staffNo: number;
  name: string;
  role: SevaRole;
  viewOnly: boolean;
}

export const E2E_STAFF: Record<E2ERole, E2EStaff> = {
  receptionist: { staffId: "staff-receptionist", staffNo: 23, name: "Lakshmi R", role: "receptionist", viewOnly: false },
  prasadam_counter: { staffId: "staff-prasadam", staffNo: 31, name: "Govinda P", role: "prasadam_counter", viewOnly: false },
  temple_admin: { staffId: "staff-temple-admin", staffNo: 5, name: "Srinivas T", role: "temple_admin", viewOnly: false },
  temple_admin_view_only: { staffId: "staff-temple-admin-view", staffNo: 6, name: "Padma V", role: "temple_admin", viewOnly: true },
  super_admin: { staffId: "staff-super-admin", staffNo: 1, name: "Raghav S", role: "super_admin", viewOnly: false },
};

const ALL_ACTIONS: readonly SevaAction[] = [
  "counter.issue",
  "counter.change_amount",
  "receipt.cancel_own",
  "receipt.cancel_any",
  "receipt.reprint",
  "dayclose.close",
  "dayclose.reopen",
  "prasadam.give",
  "prasadam.give_off_date",
  "prasadam.reverse",
  "reports.view",
  "export.basic",
  "export.with_phones",
  "sevas.edit",
  "settings.edit",
  "device.register",
  "gap.resolve",
  "staff.onboard",
  "staff.grant_super_admin",
  "staff.change_role",
  "staff.reactivate",
  "staff.deactivate",
  "staff.delete",
  "payments.view",
  "payments.refund",
  "payments.fee_rule",
  "receipts.list",
  "sevas.read",
  "devotees.search",
  "counter.heartbeat",
  "me",
];

const SUPER_ADMIN_ONLY: readonly SevaAction[] = ["staff.grant_super_admin", "staff.deactivate", "staff.delete", "payments.fee_rule"];

/** A simple copy of the Design Book 3.3 matrix (the real rules live in lib/seva/permissions.ts on the server). */
export const E2E_ROLE_ACTIONS: Record<E2ERole, readonly SevaAction[]> = {
  receptionist: [
    "me",
    "sevas.read",
    "counter.issue",
    "counter.change_amount",
    "counter.heartbeat",
    "receipt.cancel_own",
    "receipt.reprint",
    "dayclose.close",
    "receipts.list",
    "devotees.search",
  ],
  prasadam_counter: ["me", "prasadam.give", "prasadam.give_off_date"],
  temple_admin: ALL_ACTIONS.filter((a) => !SUPER_ADMIN_ONLY.includes(a)),
  temple_admin_view_only: ["me", "reports.view", "export.basic", "payments.view", "receipts.list", "sevas.read"],
  super_admin: ALL_ACTIONS,
};

export function defaultMe(): Record<E2ERole, SevaMe> {
  const entries = (Object.keys(E2E_STAFF) as E2ERole[]).map((role): [E2ERole, SevaMe] => {
    const s = E2E_STAFF[role];
    const atCounter = E2E_ROLE_ACTIONS[role].includes("counter.issue");
    return [
      role,
      {
        staffId: s.staffId,
        staffNo: s.staffNo,
        name: s.name,
        role: s.role,
        viewOnly: s.viewOnly,
        actions: [...E2E_ROLE_ACTIONS[role]],
        counter: atCounter ? { ...E2E_COUNTER } : null,
      },
    ];
  });
  return Object.fromEntries(entries) as Record<E2ERole, SevaMe>;
}

function seva(partial: Partial<CatalogueSeva> & Pick<CatalogueSeva, "id" | "key" | "nameEn">): CatalogueSeva {
  return {
    code: null,
    nameKn: null,
    ratePaise: 0,
    multiDate: false,
    allowAmountChange: true,
    prasadamGiven: true,
    prasadamItems: null,
    visibility: "both",
    active: true,
    category: "Pooja",
    incomeLedger: null,
    ...partial,
  };
}

export function defaultCatalogue(): CatalogueSeva[] {
  return [
    seva({ id: "seva-archana", code: "AR", key: 1, nameEn: "Archana", nameKn: "ಅರ್ಚನೆ", ratePaise: 5000, prasadamItems: "Kumkum, flowers" }),
    seva({ id: "seva-abhisheka", code: "PA", key: 2, nameEn: "Panchamrutha Abhisheka", nameKn: "ಪಂಚಾಮೃತ ಅಭಿಷೇಕ", ratePaise: 25000, prasadamItems: "Panchamrutha" }),
    seva({ id: "seva-paaduka", code: "PP", key: 3, nameEn: "Paaduka Pooja", nameKn: "ಪಾದುಕಾ ಪೂಜೆ", ratePaise: 50000, multiDate: true, prasadamItems: "Laddu" }),
    seva({ id: "seva-sarva", code: "SS", key: 4, nameEn: "Sarva Seva", nameKn: "ಸರ್ವ ಸೇವೆ", ratePaise: 150000, allowAmountChange: false, prasadamItems: "Laddu, vastra" }),
    seva({ id: "seva-karnike", code: "KA", key: 5, nameEn: "Other Seva / Karnike", nameKn: "ಇತರ ಸೇವೆ / ಕಾಣಿಕೆ", ratePaise: null, visibility: "counter", prasadamGiven: false, category: "Offering" }),
    seva({ id: "seva-rathotsava", code: "RT", key: 6, nameEn: "Rathotsava Seva", nameKn: "ರಥೋತ್ಸವ ಸೇವೆ", ratePaise: 100000, visibility: "online" }),
    seva({ id: "seva-tulabhara", code: "TB", key: 7, nameEn: "Tulabhara", nameKn: "ತುಲಾಭಾರ", ratePaise: 200000, active: false }),
  ];
}

export const DEFAULT_SLIP: SlipSettings = {
  templeNameEn: "Sri Raghavendra Swamy Matha",
  templeNameKn: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ",
  addressLine1: "Demo address line 1",
  addressLine2: "Demo address line 2",
  registrationLine: null,
  photoLeftUrl: null,
  photoRightUrl: null,
  footerLine1: "Please keep this slip for prasadam.",
  footerLine2: "Seva timings 7:00 am - 12:30 pm",
  footerBlessing: "Sri Gurubhyo Namaha",
  printGotra: true,
  printNakshatra: true,
  printRashi: true,
};

/** Settings by section, as `GET /api/seva/settings/<section>` answers them. */
export interface E2ESettings {
  slip: SlipSettings;
  rules: CounterBootstrap["rules"];
  denominations: CounterBootstrap["denominations"];
  festivalDays: CounterBootstrap["festivalChips"];
  upi: CounterBootstrap["upi"];
  counters: CounterBootstrap["counter"][];
}

export function defaultSettings(): E2ESettings {
  return {
    slip: { ...DEFAULT_SLIP },
    rules: { cancelWindowMinutes: 30, amountChangeReasonRequired: true, counterDaysAhead: 365, cashDifferenceNoteRequired: true },
    denominations: [
      { kind: "note", valuePaise: 50000 },
      { kind: "note", valuePaise: 20000 },
      { kind: "note", valuePaise: 10000 },
      { kind: "note", valuePaise: 5000 },
      { kind: "note", valuePaise: 2000 },
      { kind: "note", valuePaise: 1000 },
      { kind: "coin", valuePaise: 500 },
      { kind: "coin", valuePaise: 200 },
      { kind: "coin", valuePaise: 100 },
    ],
    festivalDays: [
      { name: "Aaradhane", nameKn: "ಆರಾಧನೆ", dates: ["2026-08-20", "2026-08-21", "2026-08-22"] },
      { name: "Karthika Deepotsava", nameKn: "ಕಾರ್ತಿಕ ದೀಪೋತ್ಸವ", dates: ["2026-11-24"] },
    ],
    upi: { vpa: "demo-temple@upi", payeeName: "Demo Temple" },
    counters: [{ ...E2E_COUNTER }],
  };
}

export function defaultStaff(): Record<string, unknown>[] {
  return (Object.keys(E2E_STAFF) as E2ERole[]).map((role) => {
    const s = E2E_STAFF[role];
    return {
      id: s.staffId,
      staffNo: s.staffNo,
      name: s.name,
      email: `e2e-${role}@example.test`,
      role: s.role,
      viewOnly: s.viewOnly,
      status: "active",
    };
  });
}

/** `GET /api/seva/reports/dashboard` answer: `{ data, attention }`. Dashboard tasks replace it with their own fixture. */
export function defaultDashboard(): Record<string, unknown> {
  return {
    data: {
      period: "today",
      totals: { receipts: 0, amountPaise: 0, cashPaise: 0, upiPaise: 0, cancelled: 0 },
      previous: { receipts: 0, amountPaise: 0 },
      bySeva: [],
      byBucket: [],
      byCounter: [],
    },
    attention: [],
  };
}

/** Answers for the other `GET /api/seva/reports/<name>` routes. */
export function defaultReports(): Record<string, unknown> {
  return {
    continuity: [],
    "seva-summary": { rows: [] },
    festival: { rows: [] },
    audit: { rows: [], nextCursor: null },
    "day-closes": { rows: [], nextCursor: null },
    export: { rows: [], nextCursor: null },
  };
}
