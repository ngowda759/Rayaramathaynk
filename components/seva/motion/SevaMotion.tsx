"use client";

import type { JSX, ReactNode } from "react";
import { LazyMotion, MotionConfig, domMax } from "framer-motion";

import { SPRING } from "@/lib/seva/motion";

/**
 * Motion for the seva pages (plan A4P-1). Inside it use `m.*`, never `motion.*` (`strict` reports a mistake).
 * Every animation springs with the owner's Lively spring, and people who ask their system for less motion get none
 * (`reducedMotion="user"`: transforms jump to the end; opacity still fades).
 *
 * `domMax` rather than `domAnimation`: the sliding Segmented pill (`layoutId`) and the counter's order lines (`layout`)
 * need the layout feature, which `domAnimation` leaves out.
 */
export function SevaMotion({ children }: { children: ReactNode }): JSX.Element {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user" transition={SPRING}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

export default SevaMotion;
