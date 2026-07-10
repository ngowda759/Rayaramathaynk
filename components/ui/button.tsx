"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  loading?: boolean;
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "danger"
    | "destructive"
    | "ghost";
  size?: "default" | "icon" | "sm" | "icon-sm";
  asChild?: boolean;
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

  const variants = {
    primary: "bg-orange-600 hover:bg-orange-700 text-white",
    secondary: "bg-stone-700 hover:bg-stone-800 text-white",
    outline: "border border-orange-600 text-orange-600 hover:bg-orange-50",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    destructive: "bg-red-600 hover:bg-red-700 text-white",
    ghost: "bg-transparent text-stone-700 hover:bg-stone-100",
  };

  const sizes = {
    default: "h-11 rounded-lg px-4 py-3",
    icon: "h-10 w-10 rounded-full p-0",
    sm: "h-9 rounded-md px-3 py-2 text-sm",
    "icon-sm": "h-8 w-8 rounded-full p-0",
  };

  return (
    <Component
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center font-medium transition disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? "Please wait..." : children}
    </Component>
  );
}

export default Button;
