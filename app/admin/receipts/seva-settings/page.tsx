"use client";

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import toast from "react-hot-toast";

import { SevaDrawer, catalogueToUpsert } from "@/components/seva/settings/SevaDrawer";
import { SevaTable } from "@/components/seva/settings/SevaTable";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { SETTINGS_TEXT as T } from "@/lib/seva/strings/settings";
import { catalogueApi } from "@/services/seva/catalogue.service";
import { SevaClientError } from "@/services/seva/http";
import type { CatalogueSeva } from "@/types/seva";
import type { SaveSevaResult } from "@/types/seva-settings";

type Phase = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready" };
/** The drawer: a seva to edit, `seva: null` to add one, or closed. */
type Drawer = { seva: CatalogueSeva | null } | null;

function messageOf(err: unknown): string {
  return err instanceof SevaClientError ? err.message : T.loadFailed;
}

function byKey(list: CatalogueSeva[]): CatalogueSeva[] {
  return [...list].sort((a, b) => a.key - b.key);
}

function SevaSettings(): JSX.Element {
  const { user } = useAuth();
  const { can } = useSevaMe();
  const editable = can("sevas.edit");
  const api = useMemo(
    () => catalogueApi(() => (user ? user.getIdToken() : Promise.reject(new Error("Sign in again to change sevas.")))),
    [user],
  );
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [sevas, setSevas] = useState<CatalogueSeva[]>([]);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const list = await api.list();
      setSevas(byKey(list));
      setPhase({ kind: "ready" });
    } catch (err) {
      setPhase({ kind: "error", message: messageOf(err) });
    }
  }, [api]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first load of the list
    void load();
  }, [load]);

  function afterSave(result: SaveSevaResult, message: string): void {
    if (result.mirror === "failed") toast.error(T.mirrorFailed);
    else toast.success(message);
  }

  async function reorder(ids: string[]): Promise<void> {
    const previous = sevas;
    const order = new Map(ids.map((id, i) => [id, i + 1]));
    // Shown at once; the office renumbers the keys 1..n in this order.
    setSevas(byKey(sevas.map((s) => ({ ...s, key: order.get(s.id) ?? s.key }))));
    setBusy(true);
    try {
      await api.reorder(ids);
      toast.success(T.reordered);
      await load();
    } catch (err) {
      setSevas(previous);
      toast.error(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(seva: CatalogueSeva, active: boolean): Promise<void> {
    setBusy(true);
    try {
      const result = await api.save({ ...catalogueToUpsert(seva), active });
      afterSave(result, active ? T.sevaSwitchedOn(seva.nameEn) : T.sevaSwitchedOff(seva.nameEn));
      await load();
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  const nextKey = sevas.reduce((max, s) => Math.max(max, s.key), 0) + 1;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Bilingual as="h1" en={T.sevasTitle.en} kn={T.sevasTitle.kn} className="text-(length:--text-h1) font-semibold" />
          <p className="text-(length:--text-meta) text-(--muted-foreground)">
            {phase.kind === "ready" ? T.sevasCount(sevas.length) : ""}
          </p>
          {editable ? null : <p className="text-(length:--text-meta) text-(--muted-foreground)">{T.viewOnly}</p>}
        </div>
        {editable ? (
          <Button variant="seva-primary" onClick={() => setDrawer({ seva: null })} disabled={phase.kind !== "ready"}>
            <Bilingual en={T.addSeva.en} kn={T.addSeva.kn} />
          </Button>
        ) : null}
      </div>

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
      ) : sevas.length === 0 ? (
        <p className="rounded-(--radius-surface) border border-(--border) bg-(--card) p-6 text-(--muted-foreground)">{T.sevasEmpty}</p>
      ) : (
        <SevaTable
          sevas={sevas}
          editable={editable}
          busy={busy}
          onEdit={(seva) => setDrawer({ seva })}
          onReorder={(ids) => void reorder(ids)}
          onToggleActive={(seva, active) => void toggleActive(seva, active)}
        />
      )}

      <p className="text-(length:--text-meta) text-(--muted-foreground)">{T.otherSevaNote}</p>

      {drawer ? (
        <SevaDrawer
          key={drawer.seva?.id ?? "new"}
          seva={drawer.seva}
          nextKey={nextKey}
          readOnly={!editable}
          api={api}
          onClose={() => setDrawer(null)}
          onSaved={(result) => {
            setDrawer(null);
            afterSave(result, T.sevaSaved);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Seva settings (DB §13.1, mockup `settings-devotee.html#sevas`): the seva catalogue from Supabase through
 * `/api/seva/sevas`. Temple admins and super admins edit; view-only temple admins see everything read-only. Every save
 * is audited by the office and mirrored to the website's Firestore `sevas` (C-39).
 */
export default function SevaSettingsPage(): JSX.Element {
  return (
    <SevaGate action="reports.view">
      <SevaSettings />
    </SevaGate>
  );
}
