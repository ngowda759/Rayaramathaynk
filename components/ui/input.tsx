"use client";

import { forwardRef, InputHTMLAttributes, useId } from "react";
import clsx from "clsx";

import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /**
   * `seva`: Seva Entry module control on the module tokens (UI-REDESIGN-PLAN 5.2, DESIGN-BOOK 18) - 46px tall,
   * label always above and tied with `for`, optional hint, error wired with `aria-describedby`.
   * Used inside the `.seva` wrapper. The default look is unchanged.
   */
  variant?: "default" | "seva";
  /** Seva variant only: one short line between the label and the control. */
  hint?: string;
}

/** Control classes of the seva variant, for callers that build their own field around a native input. */
export const sevaControlClass =
  "h-[46px] w-full rounded-(--radius-control) border border-(--border-strong) bg-(--input) px-4 text-(length:--text-body) text-(--foreground) transition-[border-color,box-shadow] duration-[120ms] placeholder:text-(--muted-foreground) hover:border-[color-mix(in_oklab,var(--foreground)_35%,var(--border-strong))] focus:border-(--primary-press) focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_30%,transparent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-(--destructive) aria-invalid:shadow-[0_0_0_4px_color-mix(in_oklab,var(--destructive)_15%,transparent)]";

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, variant = "default", hint, ...props }, ref) => {
    const autoId = useId();

    if (variant === "seva") {
      const id = props.id ?? autoId;
      const hintId = hint ? `${id}-hint` : undefined;
      const errorId = error ? `${id}-error` : undefined;
      const describedBy =
        [props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;
      return (
        <div className="flex min-w-0 flex-col gap-1.5">
          {label && (
            <label
              htmlFor={id}
              className="text-(length:--text-meta) font-semibold text-(--foreground)"
            >
              {label}
            </label>
          )}
          {hint && (
            <span id={hintId} className="text-(length:--text-meta) text-(--muted-foreground)">
              {hint}
            </span>
          )}
          <input
            ref={ref}
            {...props}
            id={id}
            aria-invalid={error ? true : props["aria-invalid"]}
            aria-describedby={describedBy}
            className={cn(sevaControlClass, className)}
          />
          {error && (
            <p
              id={errorId}
              className="flex items-center gap-1.5 text-(length:--text-meta) text-(--destructive)"
            >
              {error}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-stone-700">
            {label}
          </label>
        )}

        <input
          ref={ref}
          className={clsx(
            "w-full rounded-lg border border-stone-300 px-4 py-3 outline-none",
            "focus:border-orange-500 focus:ring-2 focus:ring-orange-200",
            error && "border-red-500",
            className
          )}
          {...props}
        />

        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
