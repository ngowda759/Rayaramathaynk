import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { RECEIPT } from "@/lib/seva/strings/receipt";

/** `/r/<token>` for a token that is not a receipt's: a 404 with one plain line (DB §10.3). */
export default function PublicReceiptNotFound(): JSX.Element {
  return (
    <div className="mx-auto max-w-md space-y-3 text-center">
      <Bilingual as="h1" en={RECEIPT.notFound.en} kn={RECEIPT.notFound.kn} className="text-lg font-semibold" />
      <Bilingual as="div" en={RECEIPT.notFoundHint.en} kn={RECEIPT.notFoundHint.kn} className="text-(--muted-foreground)" />
    </div>
  );
}
