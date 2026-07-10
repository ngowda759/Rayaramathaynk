import * as React from "react"

import { cn } from "@/lib/utils"

interface TextareaProps extends React.ComponentProps<"textarea"> {
  label?: string;
  error?: string;
}

function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-stone-700">
          {label}
        </label>
      )}

      <textarea
        data-slot="textarea"
        className={cn(
          "flex field-sizing-content min-h-16 w-full resize-none rounded-2xl border border-stone-300 bg-input/50 px-2.5 py-2 text-base transition-[color,box-shadow] duration-200 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          error && "border-red-500",
          className
        )}
        {...props}
      />

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}

export { Textarea }
