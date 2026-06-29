"use client";

import FormGroup from "./FormGroup";

interface FormSwitchFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  helperText?: string;
}

export default function FormSwitchField({
  label,
  checked,
  onChange,
  error,
  helperText,
}: FormSwitchFieldProps) {
  return (
    <FormGroup
      label={label}
      error={error}
      helperText={helperText}
    >
      <label className="inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
        />

        <span className="ml-3 text-sm text-stone-700">
          {checked ? "Active" : "Inactive"}
        </span>
      </label>
    </FormGroup>
  );
}
