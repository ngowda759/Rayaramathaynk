"use client";

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import { SkeletonRows } from "@/components/seva/motion/PageSkeleton";
import { Reveal } from "@/components/seva/motion/Reveal";
import { DevoteeListsEditor } from "@/components/seva/settings/lists/DevoteeListsEditor";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { LISTS_TEXT as T } from "@/lib/seva/strings/lists";
import { SevaClientError } from "@/services/seva/http";
import { listsApi } from "@/services/seva/lists.service";
import type { SevaLists } from "@/types/seva";

type Phase = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; lists: SevaLists };

function DevoteeLists(): JSX.Element {
  const { user } = useAuth();
  const { can } = useSevaMe();
  const editable = can("settings.edit");
  const api = useMemo(
    () => listsApi(() => (user ? user.getIdToken() : Promise.reject(new Error("Sign in again to change settings.")))),
    [user],
  );
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const load = useCallback(async (): Promise<void> => {
    try {
      setPhase({ kind: "ready", lists: await api.getLists() });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof SevaClientError ? err.message : T.loadFailed.en });
    }
  }, [api]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first load of the lists
    void load();
  }, [load]);

  if (phase.kind === "loading") {
    return <SkeletonRows label={T.loading.en} />;
  }
  if (phase.kind === "error") {
    return (
      <Reveal>
        <div role="alert" className="flex flex-col items-start gap-3 rounded-(--radius-surface) border border-(--border) bg-(--card) p-6">
          <p className="m-0 font-semibold">{phase.message}</p>
          <Button variant="seva-secondary" onClick={() => void load()}>
            {T.tryAgain}
          </Button>
        </div>
      </Reveal>
    );
  }
  return (
    <Reveal>
      <DevoteeListsEditor lists={phase.lists} editable={editable} onSave={(input) => api.saveItem(input)} />
    </Reveal>
  );
}

/**
 * Settings - Devotee lists (plan A4P-5): the gotra, nakshatra and rashi lists the counter offers. Temple admins and
 * super admins add and correct; view-only temple admins see the lists read-only (the server refuses their saves too).
 */
export default function DevoteeListsPage(): JSX.Element {
  return (
    <SevaGate action="reports.view">
      <DevoteeLists />
    </SevaGate>
  );
}

