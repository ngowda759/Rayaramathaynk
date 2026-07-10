"use client";

import {
  SelectHTMLAttributes,
} from "react";
import clsx from "clsx";

import FormGroup from "./FormGroup";

export interface SelectOption {
  label: string;
  value: string;
}

interface FormSelectFieldProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
  required?: boolean;
}

export default function FormSelectField({
  label,
  options,
  error,
  helperText,
  required = false,
  className,
  id,
  ...props
}: FormSelectFieldProps) {
  const inputId = id ?? props.name;

  return (
    <FormGroup
      label={label}
      error={error}
      helperText={helperText}
      required={required}
      htmlFor={inputId}
    >
      <select
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
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </FormGroup>
  );
}
