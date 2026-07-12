"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AdminButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
}

export default function AdminButton({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconPosition = "left",
  className,
  disabled,
  type = "button",
  onClick,
}: AdminButtonProps) {
  const sizeStyles = {
    sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
    md: "h-10 px-4 text-sm rounded-xl gap-2",
    lg: "h-12 px-6 text-base rounded-xl gap-2.5",
  };

  const variantStyles = {
    primary: `
      bg-gradient-to-r from-amber-500 to-orange-500 text-white
      shadow-lg shadow-amber-500/25
      hover:shadow-xl hover:shadow-amber-500/30 hover:scale-[1.02]
      active:scale-[0.98] active:shadow-md
      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
    `,
    secondary: `
      bg-white text-stone-700 border border-amber-200
      shadow-sm hover:shadow-md hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50
      active:scale-[0.98]
      disabled:opacity-50 disabled:cursor-not-allowed
    `,
    outline: `
      border-2 border-amber-300 text-amber-700 bg-transparent
      hover:bg-gradient-to-r hover:from-amber-500 hover:to-orange-500 hover:text-white hover:border-transparent
      active:scale-[0.98]
      disabled:opacity-50 disabled:cursor-not-allowed
    `,
    ghost: `
      text-stone-600 bg-transparent
      hover:bg-amber-50 hover:text-amber-700
      active:scale-[0.98]
      disabled:opacity-50 disabled:cursor-not-allowed
    `,
    danger: `
      bg-red-500 text-white
      shadow-lg shadow-red-500/25
      hover:bg-red-600 hover:shadow-red-500/30 hover:scale-[1.02]
      active:scale-[0.98] active:shadow-md
      disabled:opacity-50 disabled:cursor-not-allowed
    `,
  };

  return (
    <motion.button
      type={type}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all duration-200",
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center bg-inherit rounded-xl">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </span>
      )}
      <span className={cn("flex items-center gap-2", loading && "invisible")}>
        {icon && iconPosition === "left" && <span className="flex-shrink-0">{icon}</span>}
        <span>{children}</span>
        {icon && iconPosition === "right" && <span className="flex-shrink-0">{icon}</span>}
      </span>
    </motion.button>
  );
}

// Icon Button variant
interface AdminIconButtonProps {
  icon: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
}

export function AdminIconButton({
  icon,
  variant = "ghost",
  size = "md",
  loading = false,
  className,
  disabled,
  onClick,
  ...props
}: AdminIconButtonProps) {
  const sizeStyles = {
    sm: "h-8 w-8 rounded-lg",
    md: "h-10 w-10 rounded-xl",
    lg: "h-12 w-12 rounded-xl",
  };

  const variantStyles = {
    primary: `
      bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg
      hover:shadow-xl hover:scale-105
      active:scale-95
    `,
    secondary: `
      bg-white text-stone-600 border border-amber-200 shadow-sm
      hover:bg-amber-50 hover:border-amber-300
      active:scale-95
    `,
    ghost: `
      text-stone-500 bg-transparent
      hover:bg-amber-50 hover:text-amber-600
      active:scale-95
    `,
  };

  return (
    <motion.button
      type="button"
      whileHover={{ scale: disabled || loading ? 1 : 1.05 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.95 }}
      className={cn(
        "inline-flex items-center justify-center transition-all duration-200",
        sizeStyles[size],
        variantStyles[variant],
        (disabled || loading) && "opacity-50 cursor-not-allowed",
        className
      )}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
    </motion.button>
  );
}
