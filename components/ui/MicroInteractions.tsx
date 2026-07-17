"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ButtonHTMLAttributes, forwardRef, InputHTMLAttributes } from "react";

// Animated button wrapper
interface AnimatedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
  enableHoverLift?: boolean;
}

export function AnimatedButton({
  variant = "primary",
  size = "md",
  children,
  className = "",
  enableHoverLift = true,
  disabled,
  type,
  onClick,
  ...rest
}: AnimatedButtonProps) {
  const reducedMotion = useReducedMotion();

  const baseStyles = `
    relative inline-flex items-center justify-center font-semibold rounded-xl
    transition-colors duration-200 focus:outline-none focus:ring-2 
    focus:ring-amber-400 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none
  `;

  const sizeStyles = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  const variantStyles = {
    primary: "bg-gradient-to-r from-amber-600 to-orange-500 text-white hover:from-amber-700 hover:to-orange-600 shadow-lg shadow-amber-500/25",
    secondary: "bg-gradient-to-r from-stone-700 to-stone-800 text-white hover:from-stone-800 hover:to-stone-900 shadow-lg shadow-stone-500/25",
    outline: "border-2 border-amber-600 text-amber-700 hover:bg-amber-50",
    ghost: "text-stone-700 hover:bg-stone-100",
  };

  const button = (
    <button
      disabled={disabled}
      type={type}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );

  if (reducedMotion || !enableHoverLift) {
    return button;
  }

  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      disabled={disabled}
      type={type}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
}

// Animated card wrapper
interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  hoverLift?: boolean;
  hoverScale?: boolean;
  enableGlow?: boolean;
}

export function AnimatedCard({
  children,
  className = "",
  hoverLift = true,
  hoverScale = false,
  enableGlow = false,
}: AnimatedCardProps) {
  const reducedMotion = useReducedMotion();

  const hoverAnimations = !reducedMotion
    ? {
        y: hoverLift ? -6 : 0,
        scale: hoverScale ? 1.02 : 1,
        boxShadow: hoverLift
          ? "0 20px 40px rgba(0, 0, 0, 0.12)"
          : "0 10px 30px rgba(0, 0, 0, 0.08)",
      }
    : {};

  return (
    <motion.div
      whileHover={hoverAnimations}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const }}
      className={className}
    >
      {enableGlow && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-400/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 blur-xl" />
      )}
      {children}
    </motion.div>
  );
}

// Interactive icon button
interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "primary" | "ghost";
  className?: string;
  onClick?: () => void;
}

export function IconButton({
  icon,
  label,
  size = "md",
  variant = "default",
  className = "",
  onClick,
}: IconButtonProps) {
  const reducedMotion = useReducedMotion();

  const sizeStyles = {
    sm: "p-2",
    md: "p-3",
    lg: "p-4",
  };

  const variantStyles = {
    default: "bg-stone-100 text-stone-700 hover:bg-stone-200",
    primary: "bg-amber-100 text-amber-700 hover:bg-amber-200",
    ghost: "bg-transparent text-stone-600 hover:bg-stone-100",
  };

  return (
    <motion.button
      whileHover={reducedMotion ? undefined : { scale: 1.1 }}
      whileTap={reducedMotion ? undefined : { scale: 0.95 }}
      className={`rounded-full ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {icon}
    </motion.button>
  );
}

// Input field with focus animation
interface AnimatedInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const AnimatedInput = forwardRef<HTMLInputElement, AnimatedInputProps>(
  function AnimatedInput(props, ref) {
    const { label, error, icon, className = "", ...rest } = props;
    const reducedMotion = useReducedMotion();

    return (
      <div className="relative">
        {label && (
          <motion.label
            className="mb-2 block text-sm font-medium text-stone-700"
            initial={reducedMotion ? undefined : { x: -10, opacity: 0 }}
            animate={reducedMotion ? undefined : { x: 0, opacity: 1 }}
          >
            {label}
          </motion.label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full rounded-xl border border-stone-300 bg-white px-4 py-3 
              text-stone-900 placeholder:text-stone-400 
              focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20
              disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500
              transition-colors duration-200
              ${icon ? "pl-10" : ""}
              ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}
              ${className}
            `}
            {...rest}
          />
        </div>
        {error && (
          <motion.p
            initial={reducedMotion ? undefined : { opacity: 0, y: -5 }}
            animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
            className="mt-1 text-sm text-red-600"
          >
            {error}
          </motion.p>
        )}
      </div>
    );
  }
);

// Toggle switch with animation
interface AnimatedToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function AnimatedToggle({
  checked,
  onChange,
  label,
  disabled = false,
  className = "",
}: AnimatedToggleProps) {
  const reducedMotion = useReducedMotion();

  return (
    <label className={`inline-flex items-center gap-3 cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
      >
        <motion.div
          className={`h-5 w-5 rounded-full shadow-md ${
            checked ? "bg-white" : "bg-stone-300"
          }`}
          animate={reducedMotion ? undefined : {
            x: checked ? 22 : 2,
          }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
        <motion.div
          className={`absolute inset-0 rounded-full ${
            checked ? "bg-amber-500" : "bg-stone-200"
          }`}
          animate={reducedMotion ? undefined : {
            opacity: checked ? 1 : 0.5,
          }}
        />
      </button>
      {label && (
        <span className="text-sm font-medium text-stone-700">{label}</span>
      )}
    </label>
  );
}

// Checkbox with animation
interface AnimatedCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export function AnimatedCheckbox({
  checked,
  onChange,
  label,
  disabled = false,
  className = "",
}: AnimatedCheckboxProps) {
  const reducedMotion = useReducedMotion();

  return (
    <label className={`inline-flex items-center gap-3 cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative flex h-5 w-5 items-center justify-center rounded border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
        style={{
          borderColor: checked ? "#d97706" : "#d6d3d1",
          backgroundColor: checked ? "#d97706" : "transparent",
        }}
      >
        <motion.svg
          viewBox="0 0 12 12"
          className="h-3 w-3"
          initial={reducedMotion ? undefined : { pathLength: 0 }}
          animate={reducedMotion ? undefined : { pathLength: checked ? 1 : 0 }}
        >
          <motion.path
            d="M2 6l3 3 5-6"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </button>
      <span className="text-sm font-medium text-stone-700">{label}</span>
    </label>
  );
}

// Link with hover animation
interface AnimatedLinkProps {
  children: React.ReactNode;
  className?: string;
  underline?: boolean;
  href: string;
}

export function AnimatedLink({
  children,
  className = "",
  underline = true,
  href,
}: AnimatedLinkProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.a
      whileHover={reducedMotion ? undefined : { x: 4 }}
      className={`inline-flex items-center gap-1 text-amber-600 hover:text-amber-700 ${
        underline ? "underline-offset-4 hover:underline" : ""
      } transition-colors ${className}`}
      href={href}
    >
      {children}
    </motion.a>
  );
}
