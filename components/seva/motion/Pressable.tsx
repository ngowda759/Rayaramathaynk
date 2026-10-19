"use client";

import type { JSX } from "react";
import { m, type HTMLMotionProps } from "framer-motion";

import { PRESS } from "@/lib/seva/motion";

export type PressableProps = HTMLMotionProps<"button">;

/**
 * A button that springs down a little when pressed (mouse, touch or keyboard). Every button prop is passed through;
 * `type` defaults to "button" so it never submits a form by accident. A disabled button does not move.
 */
export function Pressable({ type = "button", disabled, whileTap, ...props }: PressableProps): JSX.Element {
  return <m.button type={type} disabled={disabled} whileTap={disabled ? undefined : (whileTap ?? PRESS)} {...props} />;
}

export default Pressable;
