"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import clsx from "clsx";

import { cn } from "@/lib/utils";

type SiteVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "danger"
  | "destructive"
  | "ghost";

/**
 * Token-based variants for the Seva Entry module (UI-REDESIGN-PLAN 5.1, DESIGN-BOOK 18). They read the module
 * tokens from styles/seva/tokens.css, so they are used inside the `.seva` wrapper.
 */
type SevaVariant = "seva-primary" | "seva-secondary" | "seva-ghost" | "seva-danger";

export type ButtonVariant = SiteVariant | SevaVariant;
export type ButtonSize = "default" | "icon" | "sm" | "icon-sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const base =
  "inline-flex items-center justify-center font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<SiteVariant, string> = {
  primary: "bg-orange-600 hover:bg-orange-700 text-white",
  secondary: "bg-stone-700 hover:bg-stone-800 text-white",
  outline: "border border-orange-600 text-orange-600 hover:bg-orange-50",
  danger: "bg-red-600 hover:bg-red-700 text-white",
  destructive: "bg-red-600 hover:bg-red-700 text-white",
  ghost: "bg-transparent text-stone-700 hover:bg-stone-100",
};

const sizes: Record<ButtonSize, string> = {
  default: "h-11 rounded-lg px-4 py-3",
  icon: "h-10 w-10 rounded-full p-0",
  sm: "h-9 rounded-md px-3 py-2 text-sm",
  "icon-sm": "h-8 w-8 rounded-full p-0",
};

const sevaBase =
  "inline-flex items-center justify-center gap-2 border border-transparent font-semibold leading-none whitespace-nowrap no-underline cursor-pointer transition-[background-color,border-color,box-shadow] duration-[120ms] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--focus)_55%,transparent)] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none aria-busy:cursor-progress";

const sevaVariants: Record<SevaVariant, string> = {
  "seva-primary":
    "bg-(--primary) text-(--primary-ink) shadow-[0_1px_2px_oklch(0.4_0.1_70/0.25)] hover:bg-(--primary-hover) active:bg-(--primary-press)",
  "seva-secondary":
    "bg-(--card) text-(--secondary-foreground) border-(--border-strong) hover:bg-(--secondary)",
  "seva-ghost": "bg-transparent text-(--foreground) hover:bg-(--secondary)",
  "seva-danger": "bg-(--destructive) text-[oklch(0.99_0_0)] hover:opacity-90",
};

const sevaSizes: Record<ButtonSize, string> = {
  default: "h-11 px-5 rounded-(--radius-control) text-(length:--text-ui)",
  icon: "h-11 w-11 p-0 rounded-(--radius-control)",
  sm: "h-9 px-3.5 rounded-[10px] text-(length:--text-ui)",
  "icon-sm": "h-9 w-9 p-0 rounded-[10px]",
};

function isSevaVariant(variant: ButtonVariant): variant is SevaVariant {
  return variant.startsWith("seva-");
}

/** The class string a Button renders before its own className; the site variants are unchanged. */
export function buttonVariants({
  variant = "primary",
  size = "default",
}: { variant?: ButtonVariant; size?: ButtonSize } = {}): string {
  if (isSevaVariant(variant)) return clsx(sevaBase, sevaVariants[variant], sevaSizes[size]);
  return clsx(base, variants[variant], sizes[size]);
}

export function Button({
  children,
  loading = false,
  variant = "primary",
  size = "default",
  asChild = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  if (isSevaVariant(variant)) {
    // Seva buttons keep their label while busy (the name must not change mid-flow) and show a spinner.
    return (
      <Component
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading && !asChild ? (
          <span
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        {children}
      </Component>
    );
  }

  return (
    <Component
      disabled={disabled || loading}
      className={clsx(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? "Please wait..." : children}
    </Component>
  );
}

export default Button;
