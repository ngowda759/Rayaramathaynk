"use client";

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import { CounterRulesForm } from "@/components/seva/settings/CounterRulesForm";
import { errorText, Notice } from "@/components/seva/settings/ReceiptSettingsFields";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { useAuth } from "@/hooks/useAuth";
import { RS } from "@/lib/seva/strings/receipt-settings";
import { settingsApi } from "@/services/seva/settings.service";
import type { CounterRules } from "@/types/seva-settings";

/**
 * Settings - Counter rules (DB §13.2): cancel window, the always-required cash-difference note and changed-amount
 * reason, days ahead for counter dates, and the day-close flag threshold. Temple admins and super admins save (the
 * office audits each save); view-only temple admins see the rules read-only.
 */

type Phase = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; rules: CounterRules };

function Rules(): JSX.Element {
  const { user } = useAuth();
  const { can } = useSevaMe();
  const api = useMemo(
    () => settingsApi(() => (user ? user.getIdToken() : Promise.reject(new Error("Sign in again to change settings.")))),
    [user],
  );
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const canEdit = can("settings.edit");

  const load = useCallback(async () => {
    setPhase({ kind: "loading" });
    try {
      setPhase({ kind: "ready", rules: await api.getRules() });
    } catch (err) {
      setPhase({ kind: "error", message: errorText(err, RS.loadFailed) });
    }
  }, [api]);

  useEffect(() => {
    // Loading from the API on arrival is the effect's job; the state is set after the call answers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Bilingual as="h2" en={RS.rulesTitle.en} kn={RS.rulesTitle.kn} />
        {canEdit ? null : <Bilingual as="div" en={RS.viewOnly.en} kn={RS.viewOnly.kn} className="meta" />}
      </div>
      {phase.kind === "loading" ? (
        <div role="status" aria-live="polite" className="p-4">
          <Bilingual en={RS.loading.en} kn={RS.loading.kn} className="text-(--muted-foreground)" />
        </div>
      ) : null}
      {phase.kind === "error" ? (
        <div className="flex flex-col items-start gap-3">
          <Notice kind="error" text={phase.message} />
          <Button type="button" variant="seva-primary" onClick={() => void load()}>
            {RS.tryAgain.en}
          </Button>
        </div>
      ) : null}
      {phase.kind === "ready" ? (
        <CounterRulesForm
          value={phase.rules}
          readOnly={!canEdit}
          save={(patch) => api.saveRules(patch)}
          onSaved={(patch) => setPhase((p) => (p.kind === "ready" ? { ...p, rules: { ...p.rules, ...patch } } : p))}
        />
      ) : null}
    </div>
  );
}

export default function CounterRulesPage(): JSX.Element {
  return (
    <SevaGate action="reports.view">
      <Rules />
    </SevaGate>
  );
}
