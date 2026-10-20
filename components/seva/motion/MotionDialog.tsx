"use client";

import type { JSX, ReactNode } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { AnimatePresence, m, useIsPresent } from "framer-motion";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/*
 * The seva dialog look, as `DialogContent variant="seva"` in components/ui/dialog draws it (that file is shared with
 * other modules and stays unchanged, so the classes are repeated here without its CSS enter/exit animation).
 * Below 640px the dialog is a bottom sheet.
 */
const SCRIM_CLASS = "seva bg-(--scrim) supports-backdrop-filter:backdrop-blur-none";
const POPUP_CLASS =
  "seva fixed top-1/2 left-1/2 z-50 grid w-[min(560px,calc(100%-2rem))] max-w-none -translate-x-1/2 -translate-y-1/2 gap-5 rounded-[22px] bg-(--card) p-6 text-(length:--text-ui) text-(--foreground) shadow-(--shadow-overlay) outline-none max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[24px] max-sm:pb-[calc(var(--space-6)+env(safe-area-inset-bottom))]";

type PopupProps = DialogPrimitive.Popup.Props;

export interface MotionDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  children: ReactNode;
  className?: string;
  /** The corner close (X) button. Default true. */
  showCloseButton?: boolean;
  initialFocus?: PopupProps["initialFocus"];
  finalFocus?: PopupProps["finalFocus"];
}

function Frame({ onOpenChange, children, className, showCloseButton = true, initialFocus, finalFocus }: Omit<MotionDialogProps, "open">): JSX.Element {
  // While it animates out the dialog no longer takes clicks.
  const present = useIsPresent();
  return (
    <DialogPrimitive.Root open onOpenChange={(next) => onOpenChange(next)}>
      <DialogPortal>
        <DialogOverlay
          className={cn(SCRIM_CLASS, !present && "pointer-events-none")}
          render={<m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />}
        />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          initialFocus={initialFocus}
          finalFocus={finalFocus}
          className={cn(POPUP_CLASS, !present && "pointer-events-none", className)}
          render={
            <m.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12, transition: { duration: 0.16 } }}
            />
          }
        >
          {children}
          {showCloseButton ? (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={<Button variant="seva-ghost" className="absolute top-3 right-3" size="icon" />}
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}

/**
 * The module's dialog with spring motion (plan A4P-1): the card grows from 0.92 and rises 24 px, the scrim fades, and
 * both animate out when `open` turns false. Base UI keeps focus trapped inside, Escape and the scrim close it, and
 * focus returns where it was. Use DialogTitle / DialogDescription (variant "seva") from components/ui/dialog inside.
 */
export function MotionDialog({ open, ...props }: MotionDialogProps): JSX.Element {
  return <AnimatePresence>{open ? <Frame key="seva-dialog" {...props} /> : null}</AnimatePresence>;
}

export default MotionDialog;
