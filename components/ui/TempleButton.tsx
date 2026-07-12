"use client";

import Link from "next/link";
import { ReactNode } from "react";
import clsx from "clsx";

interface TempleButtonProps {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  loading?: boolean;
  disabled?: boolean;
}

export default function TempleButton({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
  icon,
  iconPosition = "left",
  loading = false,
  disabled = false,
}: TempleButtonProps) {
  const sizeStyles = {
    sm: "px-5 py-2.5 text-xs rounded-xl",
    md: "px-7 py-3.5 text-sm rounded-2xl",
    lg: "px-9 py-4 text-base rounded-2xl",
  };

  const baseStyles = `
    inline-flex items-center justify-center font-semibold transition-all duration-300
    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
  `;

  const variantStyles = {
    primary: `
      bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500
      text-white shadow-lg
      hover:shadow-xl hover:shadow-amber-500/25 hover:scale-[1.02]
      active:scale-[0.98] active:shadow-md
      focus-visible:ring-amber-500
      relative overflow-hidden
    `,
    secondary: `
      bg-white text-stone-800
      border border-amber-200/50
      shadow-md hover:shadow-lg hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50
      hover:border-amber-300
      active:scale-[0.98]
      focus-visible:ring-amber-400
    `,
    outline: `
      border-2 border-gradient-to-r from-amber-500 to-orange-500
      text-amber-700
      hover:bg-gradient-to-r hover:from-amber-600 hover:to-orange-500 hover:text-white
      active:scale-[0.98]
      focus-visible:ring-amber-500
    `,
    ghost: `
      text-stone-600
      hover:bg-amber-50 hover:text-amber-700
      active:scale-[0.98]
      focus-visible:ring-amber-400
    `,
  };

  const styles = clsx(
    baseStyles,
    sizeStyles[size],
    variantStyles[variant],
    "group",
    className
  );

  const content = (
    <>
      {/* Shimmer effect for primary button */}
      {variant === "primary" && (
        <span className="absolute inset-0 -translate-x-full skew-x-[-20deg] group-hover:translate-x-full transition-transform duration-700">
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </span>
      )}
      
      {/* Loading spinner */}
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center bg-inherit">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </span>
      )}
      
      <span className={clsx("flex items-center gap-2", loading && "invisible")}>
        {icon && iconPosition === "left" && (
          <span className="transition-transform group-hover:scale-110">{icon}</span>
        )}
        <span>{children}</span>
        {icon && iconPosition === "right" && (
          <span className="transition-transform group-hover:translate-x-1 group-hover:scale-110">
            {icon}
          </span>
        )}
      </span>
    </>
  );

  if (href && !disabled && !loading) {
    return (
      <Link href={href} className={styles}>
        {content}
      </Link>
    );
  }

  return (
    <button className={styles} disabled={disabled || loading}>
      {content}
    </button>
  );
}
