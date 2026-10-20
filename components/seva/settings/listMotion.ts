import type { Variants } from "framer-motion";

import { enterVariants } from "@/lib/seva/motion";

/** A settings list row: arrives with the module spring, leaves with a short fade. */
const rowVariants = {
  hidden: enterVariants.hidden,
  shown: enterVariants.shown,
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
} as const satisfies Variants;

/**
 * Motion props for a row of an editable settings list (plan A4P-4), spread onto an `m.tr` / `m.li` inside
 * `<AnimatePresence initial={false}>`: an added row springs in, a removed one fades out, and a reordered row slides to
 * its new place (`layout="position"`, transform only). Rows already there when the page opens do not move.
 */
export const LIST_ROW = {
  layout: "position",
  variants: rowVariants,
  initial: "hidden",
  animate: "shown",
  exit: "exit",
} as const;
