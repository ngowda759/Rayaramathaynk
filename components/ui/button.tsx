"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  loading?: boolean;
  variant?: "primary" | "secondary" | "outline" | "danger";
}

export default function Button({
  children,
  loading = false,
  variant = "primary",
  className,
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-orange-600 hover:bg-orange-700 text-white",
    secondary:
      "bg-stone-700 hover:bg-stone-800 text-white",
    outline:
      "border border-orange-600 text-orange-600 hover:bg-orange-50",
    danger:
      "bg-red-600 hover:bg-red-700 text-white",
  };

  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        "w-full rounded-lg px-4 py-3 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      {...props}
    >
      {loading ? "Please wait..." : children}
    </button>
  );
}
