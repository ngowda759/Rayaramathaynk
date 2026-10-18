import {
  can,
  isWriteAction,
  mapFirestoreRole,
  SEVA_ACTIONS,
  type PermissionContext,
  type SevaAction,
  type SevaActor,
} from "@/lib/seva/permissions";

type Who = Pick<SevaActor, "role" | "viewOnly" | "staffId">;
type Column = "R" | "P" | "TA" | "TV" | "SA";

const TODAY = "2026-10-18";
const YESTERDAY = "2026-10-17";

const ACTORS: Record<Column, Who> = {
  R: { role: "receptionist", viewOnly: false, staffId: "staff-r" },
  P: { role: "prasadam_counter", viewOnly: false, staffId: "staff-p" },
  TA: { role: "temple_admin", viewOnly: false, staffId: "staff-ta" },
  TV: { role: "temple_admin", viewOnly: true, staffId: "staff-tv" },
  SA: { role: "super_admin", viewOnly: false, staffId: "staff-sa" },
};

/** A context that satisfies every conditional cell of DB §3.3 for this actor. */
function satisfying(who: Who): PermissionContext {
  return {
    counterIdOfDevice: 1,
    receiptCounterId: 1,
    receiptBusinessDate: TODAY,
    todayBusinessDate: TODAY,
    receiptIssuedByStaffId: who.staffId,
    withinCancelWindow: true,
    targetRole: "receptionist",
    targetStaffId: "staff-someone-else",
    newRole: "prasadam_counter",
  };
}

// A literal copy of DB §3.3 rows 1-26 as [action, R, P, TA, TV, SA].
const MATRIX: [SevaAction, string, string, string, string, string][] = [
  ["counter.issue", "Y", "-", "Y", "-", "Y"], ["counter.change_amount", "Y", "-", "Y", "-", "Y"],
  ["receipt.cancel_own", "Y", "-", "Y", "-", "Y"], ["receipt.cancel_any", "-", "-", "Y", "-", "Y"],
  ["receipt.reprint", "Y", "-", "Y", "-", "Y"], ["dayclose.close", "Y", "-", "Y", "-", "Y"],
  ["dayclose.reopen", "-", "-", "Y", "-", "Y"], ["prasadam.give", "-", "Y", "Y", "-", "Y"],
  ["prasadam.give_off_date", "-", "Y", "Y", "-", "Y"], ["prasadam.reverse", "-", "-", "Y", "-", "Y"],
  ["reports.view", "-", "-", "Y", "Y", "Y"], ["export.basic", "-", "-", "Y", "Y", "Y"],
  ["export.with_phones", "-", "-", "Y", "-", "Y"], ["sevas.edit", "-", "-", "Y", "-", "Y"],
  ["settings.edit", "-", "-", "Y", "-", "Y"], ["device.register", "-", "-", "Y", "-", "Y"],
  ["gap.resolve", "-", "-", "Y", "-", "Y"], ["staff.onboard", "-", "-", "Y", "-", "Y"],
  ["staff.grant_super_admin", "-", "-", "-", "-", "Y"], ["staff.change_role", "-", "-", "Y", "-", "Y"],
  ["staff.reactivate", "-", "-", "Y", "-", "Y"], ["staff.deactivate", "-", "-", "-", "-", "Y"],
  ["staff.delete", "-", "-", "-", "-", "Y"], ["payments.view", "-", "-", "Y", "Y", "Y"],
  ["payments.refund", "-", "-", "Y", "-", "Y"], ["payments.fee_rule", "-", "-", "-", "-", "Y"],
];

const COLUMNS: Column[] = ["R", "P", "TA", "TV", "SA"];

describe("can - DB §3.3 role x action matrix", () => {
  test.each(MATRIX)("%s follows DB 3.3", (action, ...cells) => {
    expect.assertions(5);
    COLUMNS.forEach((column, i) => {
      const who = ACTORS[column];
      const expected = cells[i] === "Y";
      expect({ column, allowed: can(who, action, satisfying(who)) }).toEqual({ column, allowed: expected });
    });
  });

  it("covers all 26 rows of DB 3.3", () => {
    expect(new Set(MATRIX.map(([action]) => action)).size).toBe(26);
  });
});

describe("can - the read actions outside the matrix", () => {
  const READS: [SevaAction, string, string, string, string, string][] = [
    ["sevas.read", "Y", "-", "Y", "Y", "Y"],
    ["devotees.search", "Y", "-", "Y", "-", "Y"],
    ["counter.heartbeat", "Y", "-", "Y", "-", "Y"],
    ["me", "Y", "Y", "Y", "Y", "Y"],
  ];

  test.each(READS)("%s is allowed for the right people", (action, ...cells) => {
    COLUMNS.forEach((column, i) => {
      const who = ACTORS[column];
      expect({ column, allowed: can(who, action, satisfying(who)) }).toEqual({ column, allowed: cells[i] === "Y" });
    });
  });
});

describe("can - conditional cells", () => {
  const R = ACTORS.R;
  const own = { counterIdOfDevice: 1, receiptCounterId: 1, todayBusinessDate: TODAY, receiptBusinessDate: TODAY };

  it("limits a receptionist's reprint and close to their own counter and today", () => {
    for (const action of ["receipt.reprint", "dayclose.close"] as const) {
      expect(can(R, action, own)).toBe(true);
      expect(can(R, action, { ...own, receiptCounterId: 2 })).toBe(false); // another counter
      expect(can(R, action, { ...own, receiptBusinessDate: YESTERDAY })).toBe(false); // another day
      expect(can(R, action, { ...own, counterIdOfDevice: undefined })).toBe(false); // no registered PC
      expect(can(R, action, { ...own, todayBusinessDate: undefined })).toBe(false); // today unknown
      expect(can(R, action, {})).toBe(false); // facts missing: fail closed
      expect(can(R, action)).toBe(false);
      // Temple admins and super admins are not limited to a counter or a day.
      expect(can(ACTORS.TA, action, { ...own, receiptCounterId: 2, receiptBusinessDate: YESTERDAY })).toBe(true);
      expect(can(ACTORS.SA, action)).toBe(true);
    }
  });

  it("limits a receptionist's own cancel to the window", () => {
    const mine = { receiptIssuedByStaffId: R.staffId, withinCancelWindow: true };
    expect(can(R, "receipt.cancel_own", mine)).toBe(true);
    expect(can(R, "receipt.cancel_own", { ...mine, withinCancelWindow: false })).toBe(false);
    expect(can(R, "receipt.cancel_own", { receiptIssuedByStaffId: R.staffId })).toBe(false);
    expect(can(R, "receipt.cancel_own", { ...mine, receiptIssuedByStaffId: "staff-other" })).toBe(false);
    expect(can(R, "receipt.cancel_own", { withinCancelWindow: true })).toBe(false);
    expect(can(R, "receipt.cancel_own")).toBe(false);
    expect(can(R, "receipt.cancel_any", mine)).toBe(false);
  });

  it("stops a temple admin changing a super admin, themself, or granting super admin", () => {
    const TA = ACTORS.TA;
    const change = { targetStaffId: "staff-other", targetRole: "receptionist" as const, newRole: "temple_admin" as const };
    expect(can(TA, "staff.change_role", change)).toBe(true);
    expect(can(TA, "staff.change_role", { targetStaffId: "staff-other", targetRole: "temple_admin" })).toBe(true); // view-only switch
    expect(can(TA, "staff.change_role", { ...change, targetRole: "super_admin" })).toBe(false); // a super admin
    expect(can(TA, "staff.change_role", { ...change, targetStaffId: TA.staffId })).toBe(false); // themself
    expect(can(TA, "staff.change_role", { ...change, newRole: "super_admin" })).toBe(false); // granting super admin
    expect(can(TA, "staff.change_role", { targetRole: "receptionist", newRole: "temple_admin" })).toBe(false); // target unknown
    expect(can(TA, "staff.change_role", { targetStaffId: "staff-other", newRole: "temple_admin" })).toBe(false); // role unknown
    expect(can(TA, "staff.grant_super_admin")).toBe(false);
    expect(can(TA, "staff.onboard", { newRole: "receptionist" })).toBe(true);
    expect(can(TA, "staff.onboard", { newRole: "super_admin" })).toBe(false);
    expect(can(TA, "staff.onboard")).toBe(false); // the new role must be named
    // A super admin may do all of these.
    const SA = ACTORS.SA;
    expect(can(SA, "staff.change_role", { ...change, targetRole: "super_admin", newRole: "super_admin" })).toBe(true);
    expect(can(SA, "staff.grant_super_admin")).toBe(true);
    expect(can(SA, "staff.onboard", { newRole: "super_admin" })).toBe(true);
  });

  it("lets receptionists list only with an own-counter, today context", () => {
    expect(can(R, "receipts.list", own)).toBe(true);
    expect(can(R, "receipts.list", { ...own, receiptCounterId: 2 })).toBe(false);
    expect(can(R, "receipts.list", { ...own, receiptBusinessDate: YESTERDAY })).toBe(false);
    expect(can(R, "receipts.list", { receiptBusinessDate: TODAY, todayBusinessDate: TODAY })).toBe(false);
    expect(can(R, "receipts.list")).toBe(false);
    expect(can(ACTORS.P, "receipts.list", own)).toBe(false);
    expect(can(ACTORS.TA, "receipts.list")).toBe(true);
    expect(can(ACTORS.TV, "receipts.list")).toBe(true);
    expect(can(ACTORS.SA, "receipts.list")).toBe(true);
  });
});

describe("can - view-only and unknown input fail closed", () => {
  it("blocks every write and the phone export for anyone who is view-only", () => {
    const viewOnlySuper: Who = { role: "super_admin", viewOnly: true, staffId: "staff-x" };
    expect(can(viewOnlySuper, "sevas.edit")).toBe(false);
    expect(can(viewOnlySuper, "export.with_phones")).toBe(false);
    expect(can(viewOnlySuper, "reports.view")).toBe(true);
    const viewOnlyReceptionist: Who = { role: "receptionist", viewOnly: true, staffId: "staff-y" };
    expect(can(viewOnlyReceptionist, "counter.issue")).toBe(false);
    expect(can(viewOnlyReceptionist, "sevas.read")).toBe(true);
  });

  it("treats a view-only flag that is not exactly false as view-only", () => {
    const odd = { role: "temple_admin", viewOnly: undefined, staffId: "staff-z" } as unknown as Who;
    expect(can(odd, "sevas.edit")).toBe(false);
    expect(can(odd, "reports.view")).toBe(true);
  });

  it("denies an unknown role or an unknown action", () => {
    const stranger = { role: "billing", viewOnly: false, staffId: "staff-b" } as unknown as Who;
    for (const action of SEVA_ACTIONS) expect(can(stranger, action)).toBe(false);
    expect(can(ACTORS.SA, "receipts.delete_everything" as SevaAction)).toBe(false);
    expect(can(ACTORS.SA, "__proto__" as SevaAction)).toBe(false);
  });
});

describe("isWriteAction", () => {
  it("marks only the reading actions as reads", () => {
    const reads = SEVA_ACTIONS.filter((action) => !isWriteAction(action)).sort();
    expect(reads).toEqual(
      [
        "devotees.search",
        "export.basic",
        "export.with_phones",
        "me",
        "payments.view",
        "receipts.list",
        "reports.view",
        "sevas.read",
      ].sort(),
    );
  });

  it("treats an unknown action as a write", () => {
    expect(isWriteAction("something.new" as SevaAction)).toBe(true);
  });

  it("lists every action exactly once", () => {
    expect(SEVA_ACTIONS).toHaveLength(31);
    expect(new Set(SEVA_ACTIONS).size).toBe(31);
  });
});

describe("mapFirestoreRole (C-62)", () => {
  it("maps Firestore roles: temple_admin and admin -> temple_admin; billing, priest, staff, user, \"\" -> null", () => {
    expect(mapFirestoreRole("temple_admin")).toBe("temple_admin");
    expect(mapFirestoreRole("admin")).toBe("temple_admin");
    for (const legacy of ["billing", "priest", "staff", "office_staff", "user", "devotee", "volunteer", ""]) {
      expect(mapFirestoreRole(legacy)).toBeNull();
    }
  });

  it("keeps the other three seva roles and the site's display spellings", () => {
    expect(mapFirestoreRole("receptionist")).toBe("receptionist");
    expect(mapFirestoreRole("prasadam_counter")).toBe("prasadam_counter");
    expect(mapFirestoreRole("super_admin")).toBe("super_admin");
    expect(mapFirestoreRole("Temple Admin")).toBe("temple_admin");
    expect(mapFirestoreRole(" Prasadam Counter ")).toBe("prasadam_counter");
  });

  it("denies misspelt, blank and non-string roles", () => {
    for (const raw of ["superadmin", "super-admin", "admins", "   ", "__proto__", "constructor", null, undefined, 1, true, {}, ["admin"]]) {
      expect(mapFirestoreRole(raw)).toBeNull();
    }
  });
});
