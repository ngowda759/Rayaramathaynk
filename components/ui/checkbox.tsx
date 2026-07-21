"use client"

import * as React from "react"
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseCheckbox.Root>) {
  return (
    <BaseCheckbox.Root
      data-slot="checkbox"
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-[4px] border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary data-[checked]:text-primary-foreground data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function CheckboxIndicator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseCheckbox.Indicator>) {
  return (
    <BaseCheckbox.Indicator
      data-slot="checkbox-indicator"
      className={cn(
        "flex h-4 w-4 items-center justify-center text-current",
        className
      )}
      {...props}
    />
  )
}

export {
  Checkbox,
  CheckboxIndicator,
}
