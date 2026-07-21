"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

// Simple dropdown menu wrapper
function DropdownMenu({ children, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dropdown-menu" {...props}>{children}</div>;
}

function DropdownMenuTrigger({ children, asChild, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, props);
  }
  return <button data-slot="dropdown-menu-trigger" type="button" {...props}>{children}</button>;
}

function DropdownMenuContent({
  className,
  children,
  align,
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "center" | "end" }) {
  return (
    <div
      data-slot="dropdown-menu-content"
      data-align={align}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg",
        align === "start" && "mr-auto",
        align === "end" && "ml-auto",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DropdownMenuItem({
  className,
  children,
  inset,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-item"
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DropdownMenuCheckboxItem({
  className,
  checked,
  onCheckedChange,
  children,
  ...props
}: React.ComponentProps<"div"> & { 
  checked?: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
        {checked && (
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="h-4 w-4">
            <path
              d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2134L3.70446 8.71261C3.44905 8.48022 3.43023 8.08494 3.66262 7.82953C3.89501 7.57412 4.29029 7.55529 4.5457 7.78769L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
              fill="currentColor"
            />
          </svg>
        )}
      </span>
      {children}
    </div>
  )
}

function DropdownMenuLabel({
  className,
  children,
  inset,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-label"
      className={cn(
        "px-2 py-1.5 text-sm font-semibold",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-muted")}
      {...props}
    />
  )
}

function DropdownMenuGroup({ children, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dropdown-menu-group" {...props}>{children}</div>;
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
