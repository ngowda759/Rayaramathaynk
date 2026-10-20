import { resolveKey, type KeyZone } from "@/lib/seva/counter/keyboard";
import { initialCounterState } from "@/lib/seva/counter/state";
import { IDS, TODAY, bookExample, reduce, run } from "./counter-fixtures";

function key(k: string, zone: KeyZone, mods: { ctrlKey?: boolean; altKey?: boolean } = {}) {
  return { key: k, zone, ctrlKey: mods.ctrlKey ?? false, altKey: mods.altKey ?? false };
}

describe("resolveKey", () => {
  const blank = initialCounterState(TODAY);

  it("adds the seva whose counter key is pressed on the tile grid", () => {
    const action = resolveKey(key("2", "tiles"), blank, 0);
    expect(action).toEqual({ type: "addByKey", key: 2 });
    if (action === null || action.type !== "addByKey") throw new Error("expected addByKey");
    expect(reduce(blank, action).lines.map((l) => l.sevaId)).toEqual([IDS.paaduka]);
    expect(resolveKey(key("0", "tiles"), blank, 0)).toBeNull();
    expect(resolveKey(key("2", "name"), blank, 0)).toBeNull();
    expect(resolveKey(key("2", "tiles", { ctrlKey: true }), blank, 0)).toBeNull();
  });

  it("adds by typed number or code from the search box with Enter", () => {
    const pa = { ...blank, step: 2 as const, search: " pa " };
    const byCode = resolveKey(key("Enter", "search"), pa, 0);
    expect(byCode).toEqual({ type: "addByCode", code: "PA" });
    if (byCode === null || byCode.type !== "addByCode") throw new Error("expected addByCode");
    expect(reduce(pa, byCode).lines.map((l) => l.sevaId)).toEqual([IDS.paaduka]);

    const three = { ...blank, step: 2 as const, search: "3" };
    expect(resolveKey(key("Enter", "search"), three, 0)).toEqual({ type: "addByKey", key: 3 });
  });

  it("moves to step 3 on Enter with an empty search", () => {
    expect(resolveKey(key("Enter", "search"), { ...blank, step: 2, search: "  " }, 0)).toEqual({ type: "goStep", step: 3 });
  });

  it("moves to the next field on Enter in step 1", () => {
    expect(resolveKey(key("Enter", "name"), blank, 0)).toEqual({ type: "focusNext" });
    expect(resolveKey(key("Enter", "field"), blank, 0)).toEqual({ type: "focusNext" });
    expect(resolveKey(key("Enter", "pay"), blank, 0)).toBeNull();
  });

  it("jumps steps with Alt+1, Alt+2, Alt+3", () => {
    for (const step of [1, 2, 3] as const) {
      expect(resolveKey(key(String(step), "other", { altKey: true }), blank, 0)).toEqual({ type: "goStep", step });
    }
    expect(resolveKey(key("4", "other", { altKey: true }), blank, 0)).toBeNull();
  });

  it("clears the order on Esc twice within 2 seconds only", () => {
    const s = bookExample();
    const first = resolveKey(key("Escape", "field"), s, 0);
    expect(first).toEqual({ type: "escape", at: 0 });
    if (first === null || first.type !== "escape") throw new Error("expected escape");
    const armed = reduce(s, first);

    const quick = resolveKey(key("Escape", "field"), armed, 1500);
    if (quick === null || quick.type !== "escape") throw new Error("expected escape");
    expect(reduce(armed, quick).lines).toEqual([]);

    const slow = resolveKey(key("Escape", "field"), armed, 2500);
    if (slow === null || slow.type !== "escape") throw new Error("expected escape");
    expect(reduce(armed, slow).lines).toHaveLength(2);
  });

  it("saves with Ctrl+Enter from any step once the order is valid", () => {
    expect(resolveKey(key("Enter", "name", { ctrlKey: true }), blank, 0)).toBeNull();
    const valid = bookExample();
    for (const zone of ["name", "search", "tiles", "pay"] as const) {
      expect(resolveKey(key("Enter", zone, { ctrlKey: true }), valid, 0)).toEqual({ type: "save" });
    }
  });

  it("save is ignored while a submit is in flight", () => {
    const busy = run([{ type: "submitStarted" }], bookExample());
    expect(resolveKey(key("Enter", "pay", { ctrlKey: true }), busy, 0)).toBeNull();
    expect(resolveKey(key("Escape", "pay"), busy, 0)).toBeNull();
  });
});
