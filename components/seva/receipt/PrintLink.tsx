"use client";

import type { JSX } from "react";
import { useLinkStatus } from "next/link";

import { SevaLink } from "@/components/seva/motion/SevaLink";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { buttonVariants } from "@/components/ui/button";
import type { Bi } from "@/lib/seva/strings/common";
import { RECEIPT } from "@/lib/seva/strings/receipt";

/** The link's words, or a spinner and "Opening the print page..." while the print page loads (useLinkStatus). */
function PrintLinkLabel({ label }: { label: Bi }): JSX.Element {
  const { pending } = useLinkStatus();
  if (!pending) return <Bilingual en={label.en} kn={label.kn} />;
  return (
    <>
      <span
        data-spinner=""
        aria-hidden="true"
        className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
      <Bilingual en={RECEIPT.openingPrint.en} kn={RECEIPT.openingPrint.kn} />
    </>
  );
}

/**
 * The receipt's Print button (plan A4P-4): a link to the print page that answers the click at once - a spinner and
 * "Opening the print page..." while the page loads, and the top progress bar through SevaLink.
 */
export function PrintLink({ href, label }: { href: string; label: Bi }): JSX.Element {
  return (
    <SevaLink href={href} className={buttonVariants({ variant: "seva-primary" })}>
      <PrintLinkLabel label={label} />
    </SevaLink>
  );
}

export default PrintLink;
