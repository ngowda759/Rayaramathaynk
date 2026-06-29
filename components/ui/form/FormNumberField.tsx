"use client";

import { InputHTMLAttributes } from "react";
import clsx from "clsx";

import FormGroup from "./FormGroup";

interface FormNumberFieldProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export default function FormNumberField({
  label,
 error,
  helperText,
  required = false,
  className,
  id,
  ...props
}: FormNumberFieldProps) {
  const inputId = id ?? props.name;

  return (
    <FormGroup
      label={label}
      error={error}
      helperText={helperText}
      required={required}
      htmlFor={inputId}
    >
      <input
        id={inputId}
        type="number"
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
    </FormGroup>
  );
}
