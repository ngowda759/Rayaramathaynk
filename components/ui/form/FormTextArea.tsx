"use client";

import { TextareaHTMLAttributes } from "react";
import clsx from "clsx";

import FormGroup from "./FormGroup";

interface FormTextAreaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export default function FormTextArea({
  label,
  error,
  helperText,
  required = false,
  className,
  id,
  ...props
}: FormTextAreaProps) {
  const inputId = id ?? props.name;

  return (
    <FormGroup
      label={label}
      error={error}
      helperText={helperText}
      required={required}
      htmlFor={inputId}
    >
      <textarea
        id={inputId}
        rows={4}
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
