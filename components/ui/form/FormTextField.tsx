"use client";

import { InputHTMLAttributes } from "react";
import clsx from "clsx";

interface FormTextFieldProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  required?: boolean;
}

export default function FormTextField({
  label,
  error,
  required = false,
  className,
  id,
  ...props
}: FormTextFieldProps) {
  const inputId = id ?? props.name;

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-stone-700"
      >
        {label}

        {required && (
          <span className="ml-1 text-red-600">*</span>
        )}
      </label>

      <input
        id={inputId}
        className={clsx(
          "w-full rounded-xl border border-stone-300 bg-white px-4 py-3",
          "transition-colors",
          "focus:border-orange-500",
          "focus:outline-none",
          "focus:ring-2",
          "focus:ring-orange-200",
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
