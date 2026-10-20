"use client";

import type { JSX, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { SHELL } from "@/lib/seva/strings/shell";
import { businessDate } from "@/lib/seva/time";
import type { SevaAction } from "@/types/seva";

export interface SevaGateProps {
  /** The action the page exists for, e.g. 'counter.issue' for the counter or 'reports.view' for Reports. */
  action: SevaAction;
  children: ReactNode;
}

/**
 * Shows a module page only to people allowed its action (DB §3.3); everyone else sees the bilingual "no access"
 * message. A page is checked at its own scope: for actions limited to "own counter, today" (Close day, Today's
 * receipts) the page counts as this PC's counter on today's date, so a receptionist at a registered counter passes.
 * This only hides; every API call is checked again on the server.
 */
export function SevaGate({ action, children }: SevaGateProps): JSX.Element {
  const { me, loading, error, can, reload } = useSevaMe();

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center p-6">
        <Bilingual en={SHELL.loading.en} kn={SHELL.loading.kn} className="text-(--muted-foreground)" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-semibold text-(--foreground)">{error}</p>
        <Bilingual as="div" en={SHELL.loadFailed.en} kn={SHELL.loadFailed.kn} className="text-(--muted-foreground)" />
        <Button variant="seva-primary" onClick={() => void reload()}>
          {SHELL.tryAgain.en}
        </Button>
      </div>
    );
  }

  const pageScope = { receiptCounterId: me?.counter?.id, receiptBusinessDate: businessDate(new Date()) };
  if (!me || !can(action, pageScope)) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <Bilingual as="h1" en={SHELL.noAccess.en} kn={SHELL.noAccess.kn} className="font-semibold text-(--foreground)" />
        <Bilingual as="div" en={SHELL.noAccessHint.en} kn={SHELL.noAccessHint.kn} className="text-(--muted-foreground)" />
      </div>
    );
  }

  return <>{children}</>;
}

export default SevaGate;
