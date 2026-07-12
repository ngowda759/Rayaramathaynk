"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AdminCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "bordered";
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

export default function AdminCard({
  children,
  className,
  variant = "default",
  hover = false,
  padding = "md",
}: AdminCardProps) {
  const paddingStyles = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  const variantStyles = {
    default: "bg-white border border-amber-100/50 shadow-sm",
    elevated: "bg-white border border-amber-100 shadow-lg shadow-stone-900/5",
    bordered: "bg-transparent border-2 border-amber-200",
  };

  return (
    <motion.div
      whileHover={hover ? { y: -2, scale: 1.01 } : undefined}
      className={cn(
        "rounded-2xl overflow-hidden",
        variantStyles[variant],
        paddingStyles[padding],
        hover && "cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-amber-200",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

// Sub-components for card structure
interface AdminCardHeaderProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function AdminCardHeader({ children, className, action }: AdminCardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <h3 className="text-lg font-bold text-stone-800">{children}</h3>
      {action && <div>{action}</div>}
    </div>
  );
}

interface AdminCardTitleProps {
  children: ReactNode;
  className?: string;
  subtitle?: string;
}

export function AdminCardTitle({ children, className, subtitle }: AdminCardTitleProps) {
  return (
    <div className={cn("mb-4", className)}>
      <h3 className="text-lg font-bold text-stone-800">{children}</h3>
      {subtitle && <p className="text-sm text-stone-500 mt-1">{subtitle}</p>}
    </div>
  );
}

interface AdminCardContentProps {
  children: ReactNode;
  className?: string;
}

export function AdminCardContent({ children, className }: AdminCardContentProps) {
  return (
    <div className={cn("text-stone-600", className)}>
      {children}
    </div>
  );
}

interface AdminCardFooterProps {
  children: ReactNode;
  className?: string;
}

export function AdminCardFooter({ children, className }: AdminCardFooterProps) {
  return (
    <div className={cn("mt-4 pt-4 border-t border-amber-100 flex items-center gap-3", className)}>
      {children}
    </div>
  );
}
