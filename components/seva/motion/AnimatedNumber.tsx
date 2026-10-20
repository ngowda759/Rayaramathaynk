"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { animate, useReducedMotionConfig } from "framer-motion";

import { chartCount } from "@/lib/seva/charts/options";
import { COUNT_SPRING } from "@/lib/seva/motion";
import { cn } from "@/lib/utils";

export interface AnimatedNumberProps {
  value: number;
  /** How a number is written. Default: Indian grouping without decimals ('1,00,000'); pass formatRupees for money. */
  format?: (n: number) => string;
  className?: string;
}

/**
 * A number that counts to its new value with a spring. It always ends exactly on `value`, keeps its width steady
 * (`tabular-nums`), and screen readers hear only the final value. Under reduced motion it shows the value at once.
 */
export function AnimatedNumber({ value, format = chartCount, className }: AnimatedNumberProps): JSX.Element {
  const reduce = useReducedMotionConfig() === true;
  const [shown, setShown] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    // Under reduced motion the value is drawn directly; the count resumes from the last drawn number if that changes.
    if (reduce || current.current === value) return undefined;
    const whole = Number.isInteger(value) && Number.isInteger(current.current);
    const controls = animate(current.current, value, {
      ...COUNT_SPRING,
      onUpdate: (v) => {
        current.current = v;
        setShown(whole ? Math.round(v) : v);
      },
      onComplete: () => {
        current.current = value;
        setShown(value);
      },
    });
    return () => controls.stop();
  }, [value, reduce]);

  const display = reduce ? value : shown;
  return (
    <span className={cn("tabular-nums", className)}>
      <span aria-hidden="true">{format(display)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

export default AnimatedNumber;
