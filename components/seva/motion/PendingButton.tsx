"use client";

import type { JSX, MouseEvent, ReactNode } from "react";

import { buttonVariants, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { useAsyncAction } from "@/hooks/seva/useAsyncAction";
import { cn } from "@/lib/utils";

import { Pressable, type PressableProps } from "./Pressable";

type SevaButtonVariant = Extract<ButtonVariant, `seva-${string}`>;

export interface PendingButtonProps extends Omit<PressableProps, "children" | "onClick"> {
  children: ReactNode;
  /** Shown beside the spinner while pending, from the screen's strings (for example "Saving..."). */
  pendingLabel: ReactNode;
  /** The work the click starts. The button is pending from the click until it settles (at least 300 ms). */
  action?: () => Promise<unknown>;
  /** Pending owned by the caller, for example a form whose submit runs the request. */
  pending?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  variant?: SevaButtonVariant;
  size?: ButtonSize;
}

/**
 * A seva button that answers the click at once: a spinner and the pending label, `aria-busy` and `disabled` while the
 * work runs, so it cannot be sent twice. Pass `action` to let the button run the work, or `pending` when the caller
 * already tracks it (for example with useAsyncAction or a form submit).
 */
export function PendingButton({
  children,
  pendingLabel,
  action,
  pending: pendingProp = false,
  onClick,
  variant = "seva-primary",
  size = "default",
  disabled,
  className,
  ...props
}: PendingButtonProps): JSX.Element {
  const { run, pending: running } = useAsyncAction(async () => {
    await action?.();
  });
  const pending = pendingProp || running;

  return (
    <Pressable
      {...props}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      onClick={(event) => {
        onClick?.(event);
        if (action && !event.defaultPrevented) void run();
      }}
    >
      {pending ? (
        <>
          <span
            data-spinner=""
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Pressable>
  );
}

export default PendingButton;
