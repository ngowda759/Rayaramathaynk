/**
 * The counter key map (Design Book 9.6). Pure: turns a key press, the zone that has focus and the order state into
 * a reducer action, a save request or a focus move. The screen decides what to do with 'save' and 'focusNext'
 * (after the last field of step 1, 'focusNext' moves to step 2).
 */
import { selectCanSave, type CounterAction, type CounterState } from "./state";

export type KeyZone = "name" | "field" | "search" | "tiles" | "pay" | "other";

export type KeyResult = CounterAction | { type: "save" } | { type: "focusNext" } | null;

const STEP_KEYS: Record<string, 1 | 2 | 3> = { "1": 1, "2": 2, "3": 3 };
const TILE_KEY = /^[1-9]$/;
const NUMBER = /^\d+$/;

export function resolveKey(
  e: { key: string; ctrlKey: boolean; altKey: boolean; zone: KeyZone },
  s: CounterState,
  now: number,
): KeyResult {
  // Ctrl+Enter saves from any step, once, and only when the order is valid.
  if (e.ctrlKey && !e.altKey && e.key === "Enter") {
    return selectCanSave(s).ok ? { type: "save" } : null;
  }
  if (e.altKey && !e.ctrlKey) {
    const step = STEP_KEYS[e.key];
    return step ? { type: "goStep", step } : null;
  }
  if (e.ctrlKey || e.altKey) return null;

  if (e.key === "Escape") return s.submitting ? null : { type: "escape", at: now };

  if (e.zone === "tiles" && TILE_KEY.test(e.key)) return { type: "addByKey", key: Number(e.key) };

  if (e.key !== "Enter") return null;
  switch (e.zone) {
    case "name":
    case "field":
      return { type: "focusNext" };
    case "search": {
      const text = s.search.trim();
      if (text.length === 0) return { type: "goStep", step: 3 };
      if (NUMBER.test(text)) return { type: "addByKey", key: Number(text) };
      return { type: "addByCode", code: text.toUpperCase() };
    }
    default:
      return null;
  }
}
