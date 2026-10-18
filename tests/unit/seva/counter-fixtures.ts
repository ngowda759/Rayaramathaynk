import type { CatalogueSeva } from "@/types/seva";
import {
  counterReducer,
  indexCatalogue,
  initialCounterState,
  type CounterAction,
  type CounterState,
} from "@/lib/seva/counter/state";

/** Shared fixtures for the counter engine tests (A2-5). Not a test file itself. */

export const TODAY = "2026-10-18";
export const DAYS_AHEAD = 365;

export const IDS = {
  panchamrutha: "11111111-1111-4111-8111-111111111111",
  paaduka: "22222222-2222-4222-8222-222222222222",
  karnike: "33333333-3333-4333-8333-333333333333",
  online: "44444444-4444-4444-8444-444444444444",
  off: "55555555-5555-4555-8555-555555555555",
} as const;

function seva(overrides: Partial<CatalogueSeva> & Pick<CatalogueSeva, "id" | "key" | "nameEn">): CatalogueSeva {
  return {
    code: null,
    nameKn: null,
    ratePaise: 10000,
    multiDate: false,
    allowAmountChange: false,
    prasadamGiven: false,
    prasadamItems: null,
    visibility: "both",
    active: true,
    category: "Pooja",
    incomeLedger: null,
    ...overrides,
  };
}

export const CATALOGUE: CatalogueSeva[] = [
  seva({ id: IDS.panchamrutha, key: 1, code: "PN", nameEn: "Panchamrutha Abhisheka", ratePaise: 10500, multiDate: true, allowAmountChange: true }),
  seva({ id: IDS.paaduka, key: 2, code: "PA", nameEn: "Paaduka Pooja", ratePaise: 50500 }),
  seva({ id: IDS.karnike, key: 3, code: "KA", nameEn: "Karnike", ratePaise: null, visibility: "counter" }),
  seva({ id: IDS.online, key: 4, code: "ON", nameEn: "Online Only Seva", visibility: "online" }),
  seva({ id: IDS.off, key: 5, code: "OF", nameEn: "Switched Off Seva", active: false }),
];

export const CAT = indexCatalogue(CATALOGUE);
export const reduce = counterReducer(CAT, DAYS_AHEAD);

export function run(actions: CounterAction[], start: CounterState = initialCounterState(TODAY)): CounterState {
  return actions.reduce(reduce, start);
}

/** The Design Book example (9.3): Panchamrutha 105 on 28, 29, 30 Aug and Paaduka Pooja 505 on 28 Aug = Rs 820. */
export function bookExample(): CounterState {
  const s = run([{ type: "setDevotee", patch: { name: "Venkatesh Rao" } }, { type: "addByKey", key: 1 }, { type: "addByKey", key: 2 }]);
  const [pn, pa] = s.lines;
  return run(
    [
      { type: "setDates", lineKey: pn.key, dates: ["2027-08-28", "2027-08-29", "2027-08-30"] },
      { type: "setDates", lineKey: pa.key, dates: ["2027-08-28"] },
    ],
    s,
  );
}
