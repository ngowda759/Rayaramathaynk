"use client";

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import { DenominationEditor, type DenominationRow } from "@/components/seva/settings/DenominationEditor";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { SETTINGS_TABS, SETTINGS_TEXT as T } from "@/lib/seva/strings/settings";
import { SevaClientError } from "@/services/seva/http";
import { settingsApi } from "@/services/seva/settings.service";

type Phase = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; rows: DenominationRow[] };

const TITLE = SETTINGS_TABS.find((t) => t.href.endsWith("/denominations"))?.label ?? { en: "Denominations", kn: "" };

function Denominations(): JSX.Element {
  const { user } = useAuth();
  const { can } = useSevaMe();
  const editable = can("settings.edit");
  const api = useMemo(
    () => settingsApi(() => (user ? user.getIdToken() : Promise.reject(new Error("Sign in again to change settings.")))),
    [user],
  );
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const load = useCallback(async (): Promise<void> => {
    try {
      const { items } = await api.getDenominations();
      const rows = [...items]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(({ kind, valuePaise, shown }) => ({ kind, valuePaise, shown }));
      setPhase({ kind: "ready", rows });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof SevaClientError ? err.message : T.loadFailed });
    }
  }, [api]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first load of the denominations
    void load();
  }, [load]);

  async function save(rows: DenominationRow[]): Promise<void> {
    await api.saveDenominations({ items: rows.map((row, i) => ({ ...row, displayOrder: i + 1 })) });
  }

  return (
    <section className="flex flex-col gap-4">
      <Bilingual as="h2" en={TITLE.en} kn={TITLE.kn} className="text-(length:--text-h2) font-semibold" />
      {phase.kind === "loading" ? (
        <div role="status" aria-live="polite" className="p-6 text-(--muted-foreground)">
          <Bilingual en={T.loading.en} kn={T.loading.kn} />
        </div>
      ) : phase.kind === "error" ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-(--radius-surface) border border-(--border) bg-(--card) p-6">
          <p className="font-semibold">{phase.message}</p>
          <Button variant="seva-secondary" onClick={() => void load()}>
            {T.tryAgain}
          </Button>
        </div>
      ) : (
        <DenominationEditor initial={phase.rows} editable={editable} onSave={save} />
      )}
    </section>
  );
}

/**
 * Settings - Cash denominations (DB §13.3, mockup `#cash-denominations`). Temple admins and super admins edit; view-only
 * temple admins see the list read-only. The office replaces the whole list on save and audits it; day close uses the
 * new list from its next close.
 */
export default function DenominationsPage(): JSX.Element {
  return (
    <SevaGate action="reports.view">
      <Denominations />
    </SevaGate>
  );
}
