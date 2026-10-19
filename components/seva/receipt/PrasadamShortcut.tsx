"use client";

import Link from "next/link";
import type { JSX } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { RECEIPT } from "@/lib/seva/strings/receipt";

/**
 * "Open in the prasadam counter" for a signed-in person who may give prasadam (DB §10.3, §11); nothing for anyone
 * else, including every visitor who is not signed in. The prasadam page looks the token up at once (`?token=`).
 * Hiding only: the prasadam API checks the person again.
 */
export function PrasadamShortcut({ token }: { token: string }): JSX.Element | null {
  const { can } = useSevaMe();
  if (!can("prasadam.give")) return null;
  return (
    <Link
      href={`/admin/prasadam?token=${encodeURIComponent(token)}`}
      className={`${buttonVariants({ variant: "seva-primary" })} w-full`}
    >
      <Bilingual en={RECEIPT.openPrasadam.en} kn={RECEIPT.openPrasadam.kn} />
    </Link>
  );
}

export default PrasadamShortcut;
