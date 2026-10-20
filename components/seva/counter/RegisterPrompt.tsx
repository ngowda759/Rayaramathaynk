import Link from "next/link";
import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { buttonVariants } from "@/components/ui/button";
import { COUNTER_TEXT } from "@/lib/seva/strings/counter";
import { SEVA_ROUTES } from "@/lib/seva/routes";

export interface RegisterPromptProps {
  /** Temple admins and super admins may register a PC (device.register); others are told whom to ask. */
  canRegister: boolean;
}

/**
 * Shown when this PC has no counter credentials (Design Book 8.4, C-37): receipts are made only on a registered
 * counter PC. A temple admin gets the way to Settings - Counters; a receptionist is told to ask one.
 */
export function RegisterPrompt({ canRegister }: RegisterPromptProps): JSX.Element {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
      <Bilingual as="h1" en={COUNTER_TEXT.registerTitle.en} kn={COUNTER_TEXT.registerTitle.kn} />
      {canRegister ? (
        <>
          <Bilingual as="div" en={COUNTER_TEXT.registerAdmin.en} kn={COUNTER_TEXT.registerAdmin.kn} className="text-(--muted-foreground)" />
          <Link href={SEVA_ROUTES.settingsCounters} className={buttonVariants({ variant: "seva-primary" })}>
            {COUNTER_TEXT.registerAdminLink.en}
          </Link>
        </>
      ) : (
        <Bilingual as="div" en={COUNTER_TEXT.registerAsk.en} kn={COUNTER_TEXT.registerAsk.kn} className="text-(--muted-foreground)" />
      )}
    </div>
  );
}

export default RegisterPrompt;
