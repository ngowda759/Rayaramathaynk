/**
 * Motion for the Seva Entry module (plan A4P-1): the owner's "Lively" spring, press feedback, the shared variants, the
 * skeleton shape of each screen, and the small store that tells the progress bar a seva navigation is pending.
 * No runtime framer-motion import here (types only), so server files such as loading.tsx can use it.
 *
 * Rules every screen follows: animate only transform and opacity; nothing moves while a person types; content is
 * readable within about 450 ms; nothing blinks; `prefers-reduced-motion` is honoured (SevaMotion sets it).
 */
import type { TargetAndTransition, Transition, Variants } from "framer-motion";

/** The owner's Lively choice from the motion demo (2026-10-19). */
export const SPRING = { type: "spring", stiffness: 380, damping: 22, mass: 1 } as const satisfies Transition;

/** A firm spring for numbers that count up: no overshoot, so an amount never shows more than it is. */
export const COUNT_SPRING = { type: "spring", stiffness: 380, damping: 44, mass: 1 } as const satisfies Transition;

/** Press feedback for anything tappable. */
export const PRESS = {
  scale: 0.94,
  transition: { type: "spring", stiffness: 900, damping: 40 },
} as const satisfies TargetAndTransition;

/** A pending state stays on screen at least this long, so it never flickers. */
export const MIN_PENDING_MS = 300;

/** Content arriving: rises a little, grows a little, fades in. */
export const enterVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  shown: { opacity: 1, y: 0, scale: 1 },
} as const satisfies Variants;

/** A list container whose children (with `enterVariants`) arrive one after another. */
export function staggerChildren(step = 0.055): Variants {
  return { hidden: {}, shown: { transition: { staggerChildren: step } } };
}

/** A step or panel sliding in from the right (and out to the left). */
export const slideIn = {
  hidden: { opacity: 0, x: 24 },
  shown: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
} as const satisfies Variants;

/** A whole page arriving after navigation: a short rise and fade, no scale (the page is large). */
export const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0 },
} as const satisfies Variants;

/* ------------------------------------------------------------------------------------------------------------------
 * Which skeleton each screen gets.
 * ------------------------------------------------------------------------------------------------------------------ */

export type SkeletonVariant = "dashboard" | "list" | "form" | "detail" | "counter";

const RECEIPTS = "/admin/receipts";
const PRASADAM = "/admin/prasadam";

/** Receipt Book paths (below /admin/receipts) and their skeleton; the longest match wins. */
const RECEIPT_SKELETONS: readonly (readonly [string, SkeletonVariant])[] = [
  ["", "dashboard"],
  ["/counter", "counter"],
  ["/counter/today", "list"],
  ["/create", "form"],
  ["/day-close", "form"],
  ["/day-closes", "list"],
  ["/register", "list"],
  ["/reports", "dashboard"],
  ["/reports/audit", "list"],
  ["/reports/export", "form"],
  ["/reports/festival", "dashboard"],
  ["/reports/summary", "dashboard"],
  ["/seva-settings", "list"],
  ["/settings", "form"],
  ["/settings/counters", "list"],
  ["/settings/denominations", "form"],
  ["/settings/festival-days", "list"],
  ["/settings/receipt", "form"],
  ["/settings/rules", "form"],
];

/** The path part of an href: no query, no hash, no trailing slash. */
export function hrefPath(href: string): string {
  const path = href.split(/[?#]/)[0] || "/";
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** True for the module's own pages (Receipt Book and Prasadam), which get the seva motion and progress bar. */
export function isSevaHref(href: string): boolean {
  const path = hrefPath(href);
  return [RECEIPTS, PRASADAM].some((root) => path === root || path.startsWith(`${root}/`));
}

/** The skeleton shaped like the screen at `href`. Any other path below /admin/receipts is one receipt (detail). */
export function skeletonFor(href: string): SkeletonVariant {
  const path = hrefPath(href);
  if (path === PRASADAM || path.startsWith(`${PRASADAM}/`)) return "form";
  if (path !== RECEIPTS && !path.startsWith(`${RECEIPTS}/`)) return "list";
  const rest = path.slice(RECEIPTS.length);
  let best: (typeof RECEIPT_SKELETONS)[number] | null = null;
  for (const entry of RECEIPT_SKELETONS) {
    const [prefix] = entry;
    const matches = prefix === "" ? rest === "" : rest === prefix || rest.startsWith(`${prefix}/`);
    if (matches && (best === null || prefix.length > best[0].length)) best = entry;
  }
  return best ? best[1] : "detail";
}

/* ------------------------------------------------------------------------------------------------------------------
 * Pending navigation store: SevaLink (useLinkStatus) and navigateWithProgress report here; RouteProgress and the
 * receipts template read it. A module store rather than a React context, because the sidebar's links sit in the admin
 * layout, outside the seva layouts that draw the bar.
 * ------------------------------------------------------------------------------------------------------------------ */

export interface NavPendingState {
  pending: boolean;
  /** Where the most recent pending navigation goes. */
  href: string | null;
}

const IDLE: NavPendingState = { pending: false, href: null };
/** A `router.push` that never lands (same page, refused) stops showing as pending after this long. */
const MANUAL_GIVE_UP_MS = 10_000;

interface Entry {
  href: string;
  manual: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

function createNavProgress() {
  const entries = new Map<number, Entry>();
  const listeners = new Set<() => void>();
  let state: NavPendingState = IDLE;
  let seq = 0;

  function emit(): void {
    const last = Array.from(entries.values()).pop();
    state = last ? { pending: true, href: last.href } : IDLE;
    listeners.forEach((listener) => listener());
  }

  function end(id: number): void {
    const entry = entries.get(id);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    entries.delete(id);
    emit();
  }

  return {
    /** Marks a navigation to `href` as pending; returns the id that ends it. */
    begin(href: string, opts: { manual?: boolean } = {}): number {
      seq += 1;
      const id = seq;
      const manual = opts.manual === true;
      const timer = manual ? setTimeout(() => end(id), MANUAL_GIVE_UP_MS) : null;
      entries.set(id, { href, manual, timer });
      emit();
      return id;
    },
    end,
    /** Ends the `router.push` navigations; called when the path changes. */
    settleManual(): void {
      let changed = false;
      for (const [id, entry] of entries) {
        if (!entry.manual) continue;
        if (entry.timer) clearTimeout(entry.timer);
        entries.delete(id);
        changed = true;
      }
      if (changed) emit();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot(): NavPendingState {
      return state;
    },
    serverSnapshot(): NavPendingState {
      return IDLE;
    },
  };
}

export const navProgress = createNavProgress();
