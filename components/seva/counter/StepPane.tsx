"use client";

import type { JSX, ReactNode, Ref } from "react";
import { m, useIsPresent } from "framer-motion";

import { slideIn } from "@/lib/seva/motion";

export interface StepPaneProps {
  children: ReactNode;
  className?: string;
  /** "region" with an aria-label, for a pane that is a landmark of its own (the close-day "Day closed" card). */
  role?: "region";
  "aria-label"?: string;
  /** Passed by AnimatePresence in "popLayout" mode to measure the leaving pane. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * One step of a flow that slides (plan A4P-2): the counter's three steps and the close-day count / "Day closed".
 * Put it, keyed by the step, directly inside `<AnimatePresence mode="popLayout" initial={false}>` in a `relative`
 * parent: the new step comes in from the right while the old one leaves to the left, popped out of the flow so
 * nothing below jumps. The leaving pane is inert, so no key, click or screen reader reaches it while it goes; the
 * caller moves focus to the new step as before.
 */
export function StepPane({ children, className, ref, ...aria }: StepPaneProps): JSX.Element {
  const present = useIsPresent();
  return (
    <m.div
      ref={ref}
      variants={slideIn}
      initial="hidden"
      animate="shown"
      exit="exit"
      inert={!present || undefined}
      className={className}
      {...aria}
    >
      {children}
    </m.div>
  );
}

export default StepPane;
