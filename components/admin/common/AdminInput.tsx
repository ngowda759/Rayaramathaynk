"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface AdminInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const AdminInput = forwardRef<HTMLInputElement, AdminInputProps>(
  ({ className, label, error, hint, type = "text", ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-stone-700">
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm text-stone-900 placeholder:text-stone-400",
            "transition-all duration-200",
            "focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:shadow-lg focus:shadow-amber-500/10",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-stone-50",
            error && "border-red-300 focus:border-red-400 focus:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-stone-400">{hint}</p>
        )}
      </div>
    );
  }
);

AdminInput.displayName = "AdminInput";

interface AdminTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const AdminTextarea = forwardRef<HTMLTextAreaElement, AdminTextareaProps>(
  ({ className, label, error, hint, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-stone-700">
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            "flex min-h-[100px] w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400",
            "transition-all duration-200 resize-none",
            "focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:shadow-lg focus:shadow-amber-500/10",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-stone-50",
            error && "border-red-300 focus:border-red-400 focus:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-stone-400">{hint}</p>
        )}
      </div>
    );
  }
);

AdminTextarea.displayName = "AdminTextarea";

interface AdminSelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

const AdminSelect = forwardRef<HTMLSelectElement, AdminSelectProps>(
  ({ className, label, error, hint, options, placeholder, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-stone-700">
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm text-stone-900",
            "transition-all duration-200 cursor-pointer",
            "focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:shadow-lg focus:shadow-amber-500/10",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-stone-50",
            error && "border-red-300 focus:border-red-400 focus:ring-red-500/20",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-stone-400">{hint}</p>
        )}
      </div>
    );
  }
);

AdminSelect.displayName = "AdminSelect";

export { AdminInput, AdminTextarea, AdminSelect };
