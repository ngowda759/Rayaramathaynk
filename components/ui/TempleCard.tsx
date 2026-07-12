"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";

interface TempleCardProps {
  children: ReactNode;
  variant?: "default" | "glass" | "elevated" | "outlined";
  hover?: boolean;
  className?: string;
  animate?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  href?: string;
  onClick?: () => void;
}

export default function TempleCard({
  children,
  variant = "default",
  hover = true,
  className,
  animate = false,
  padding = "md",
  href,
  onClick,
}: TempleCardProps) {
  const paddingStyles = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  const baseStyles = `
    rounded-3xl relative overflow-hidden
    transition-all duration-400 ease-out
  `;

  const variantStyles = {
    default: `
      bg-gradient-to-br from-white to-amber-50/30
      border border-amber-100/50
      shadow-lg shadow-stone-900/5
    `,
    glass: `
      bg-white/70 backdrop-blur-xl
      border border-white/20
      shadow-xl shadow-stone-900/10
    `,
    elevated: `
      bg-gradient-to-br from-white via-amber-50/20 to-orange-50/10
      border border-amber-200/30
      shadow-2xl shadow-amber-900/10
    `,
    outlined: `
      bg-transparent
      border-2 border-amber-200
    `,
  };

  const hoverStyles = hover ? "group cursor-pointer" : "";

  const cardContent = (
    <>
      {/* Decorative corner accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-200/20 to-transparent rounded-bl-full" />
      
      {/* Content */}
      <div className={clsx(paddingStyles[padding], "relative z-10")}>
        {children}
      </div>
      
      {/* Hover glow effect */}
      {hover && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5" />
        </div>
      )}
    </>
  );

  const cardClasses = clsx(
    baseStyles,
    variantStyles[variant],
    hoverStyles,
    className
  );

  if (href) {
    return (
      <a href={href} className={cardClasses}>
        {cardContent}
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={clsx(cardClasses, "w-full text-left")}
      >
        {cardContent}
      </button>
    );
  }

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className={cardClasses}
      >
        {cardContent}
      </motion.div>
    );
  }

  return <div className={cardClasses}>{cardContent}</div>;
}

// Sub-component for card headers
interface TempleCardHeaderProps {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export function TempleCardHeader({ children, className, icon }: TempleCardHeaderProps) {
  return (
    <div className={clsx("flex items-center gap-3 mb-4", className)}>
      {icon && (
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-bold text-stone-900">{children}</h3>
    </div>
  );
}

// Sub-component for card content
interface TempleCardContentProps {
  children: ReactNode;
  className?: string;
}

export function TempleCardContent({ children, className }: TempleCardContentProps) {
  return (
    <div className={clsx("text-stone-600 leading-relaxed", className)}>
      {children}
    </div>
  );
}

// Sub-component for card footer
interface TempleCardFooterProps {
  children: ReactNode;
  className?: string;
}

export function TempleCardFooter({ children, className }: TempleCardFooterProps) {
  return (
    <div className={clsx("mt-4 pt-4 border-t border-amber-100", className)}>
      {children}
    </div>
  );
}
