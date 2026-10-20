"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

const thumbClass =
  "pointer-events-none block rounded-2xl bg-background shadow-sm ring-0 transition-transform not-dark:bg-clip-padding group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-checked:translate-x-[calc(100%-4px)] dark:data-checked:bg-primary-foreground data-unchecked:translate-x-0 dark:data-unchecked:bg-foreground"

/** Seva Entry module look (UI-REDESIGN-PLAN 5.2, DESIGN-BOOK 18): 44 x 26 track, gold-press when on. */
const sevaRootClass =
  "rounded-full border-[3px] data-[size=default]:h-[26px] data-[size=default]:w-11 data-[size=sm]:h-5 data-[size=sm]:w-9 data-checked:border-(--primary-press) data-checked:bg-(--primary-press) data-unchecked:border-(--border-strong) data-unchecked:bg-(--border-strong) focus-visible:ring-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--focus)_55%,transparent)] aria-invalid:border-(--destructive)"

const sevaThumbClass =
  "rounded-full bg-white shadow-[0_1px_2px_oklch(0_0_0/0.2)] group-data-[size=default]/switch:size-5 group-data-[size=sm]/switch:size-3.5 data-checked:translate-x-[18px] group-data-[size=sm]/switch:data-checked:translate-x-4 dark:data-checked:bg-white dark:data-unchecked:bg-white"

function Switch({
  className,
  size = "default",
  variant = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
  /** `seva`: token-based look for the Seva Entry module; the default look is unchanged. */
  variant?: "default" | "seva"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-2xl border-2 transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-5 data-[size=default]:w-8 data-[size=sm]:h-4 data-[size=sm]:w-6 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-unchecked:border-transparent data-unchecked:bg-input/90 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        variant === "seva" && sevaRootClass,
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={variant === "seva" ? cn(thumbClass, sevaThumbClass) : thumbClass}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
