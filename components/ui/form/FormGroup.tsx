"use client";

import { ReactNode } from "react";
import clsx from "clsx";

interface FormGroupProps {
  label: string;
  children: ReactNode;
  error?: string;
  helperText?: string;
  required?: boolean;
  className?: string;
  htmlFor?: string;
}

export default function FormGroup({
  label,
  children,
  error,
  helperText,
  required = false,
  className,
  htmlFor,
}: FormGroupProps) {
  return (
    <div className={clsx("space-y-2", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-stone-700"
      >
        {label}

        {required && (
          <span className="ml-1 text-red-600">*</span>
        )}
      </label>

      {children}

      {helperText && !error && (
        <p className="text-xs text-stone-500">
          {helperText}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
