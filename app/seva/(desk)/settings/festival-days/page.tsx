"use client";

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import { FestivalEditor } from "@/components/seva/settings/FestivalEditor";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { calendar } from "@/data/calendar";
import { useAuth } from "@/hooks/useAuth";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import type { FestivalRequest } from "@/lib/seva/schemas";
import { SETTINGS_TABS, SETTINGS_TEXT as T } from "@/lib/seva/strings/settings";
import { businessDate } from "@/lib/seva/time";
import { SevaClientError } from "@/services/seva/http";
import { settingsApi } from "@/services/seva/settings.service";
import type { FestivalItem } from "@/types/seva-settings";

type Phase = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; festivals: FestivalItem[] };

const TITLE = SETTINGS_TABS.find((t) => t.href.endsWith("/festival-days"))?.label ?? { en: "Festival days", kn: "" };

function FestivalDays(): JSX.Element {
  const { user } = useAuth();
  const { can } = useSevaMe();
  const editable = can("settings.edit");
  const api = useMemo(
    () => settingsApi(() => (user ? user.getIdToken() : Promise.reject(new Error("Sign in again to change settings.")))),
    [user],
  );
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [today] = useState(() => businessDate(new Date()));

  const load = useCallback(async (): Promise<void> => {
    try {
      setPhase({ kind: "ready", festivals: await api.listFestivals() });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof SevaClientError ? err.message : T.loadFailed });
    }
  }, [api]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first load of the festivals
    void load();
  }, [load]);

  async function save(festival: FestivalRequest): Promise<void> {
    await api.saveFestival(festival);
    await load();
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
        <FestivalEditor festivals={phase.festivals} today={today} editable={editable} calendar={calendar.festivals} onSave={save} />
      )}
    </section>
  );
}

/**
 * Settings - Festival days (DB §13.4, mockup `#festival-days`). The quick chips of every date picker; "Copy from
 * festival calendar" offers the dates of the website's festival calendar (`data/calendar.ts`, the source the public
 * calendar page shows). Temple admins and super admins edit; view-only temple admins see the list read-only.
 */
export default function FestivalDaysPage(): JSX.Element {
  return (
    <SevaGate action="reports.view">
      <FestivalDays />
    </SevaGate>
  );
}
