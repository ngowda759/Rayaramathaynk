import React from "react";
import clsx from "clsx";

import { cn } from "@/lib/utils";

interface BaseProps {
  children: React.ReactNode;
  className?: string;
  /**
   * `seva`: Seva Entry module card shell on the module tokens (UI-REDESIGN-PLAN 5.3, DESIGN-BOOK 18) - 18px radius,
   * border plus a very soft shadow. Used inside the `.seva` wrapper. The default look is unchanged.
   */
  variant?: "default" | "seva";
}

export function Card({ children, className, variant = "default" }: BaseProps) {
  return (
    <div
      className={
        variant === "seva"
          ? cn(
              "min-w-0 rounded-(--radius-surface) border border-(--border) bg-(--card) text-(--foreground) shadow-(--shadow-card)",
              className
            )
          : clsx(
              "rounded-2xl border border-stone-200 bg-white shadow-lg",
              className
            )
      }
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, variant = "default" }: BaseProps) {
  return (
    <div
      className={
        variant === "seva"
          ? cn("border-b border-(--border) p-6", className)
          : clsx("border-b border-stone-200 p-6", className)
      }
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className, variant = "default" }: BaseProps) {
  return (
    <h2
      className={
        variant === "seva"
          ? cn("text-(length:--text-h3) leading-snug font-semibold text-(--foreground)", className)
          : clsx("text-xl font-semibold text-stone-900", className)
      }
    >
      {children}
    </h2>
  );
}

export function CardDescription({ children, className, variant = "default" }: BaseProps) {
  return (
    <p
      className={
        variant === "seva"
          ? cn("mt-2 text-(length:--text-meta) text-(--muted-foreground)", className)
          : clsx("mt-2 text-sm text-stone-500", className)
      }
    >
      {children}
    </p>
  );
}

export function CardContent({ children, className }: BaseProps) {
  return <div className={clsx("p-6", className)}>{children}</div>;
}

export function CardFooter({ children, className, variant = "default" }: BaseProps) {
  return (
    <div
      className={
        variant === "seva"
          ? cn("flex justify-end gap-3 border-t border-(--border) p-6", className)
          : clsx("flex justify-end border-t border-stone-200 p-6", className)
      }
    >
      {children}
    </div>
  );
}

export default Card;
