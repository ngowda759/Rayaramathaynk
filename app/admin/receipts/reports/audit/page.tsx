"use client";

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import toast from "react-hot-toast";

import { AuditTrail, type AuditPerson, type AuditTypeFilter } from "@/components/seva/reports/AuditTrail";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { AUDIT, REPORTS } from "@/lib/seva/strings/reports";
import { SevaClientError } from "@/services/seva/http";
import { reportsApi, type AuditEntry } from "@/services/seva/reports.service";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; entries: AuditEntry[]; nextCursor: string | null; more: boolean };

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function AuditScreen(): JSX.Element {
  const { user } = useAuth();
  const [type, setType] = useState<AuditTypeFilter>("all");
  const [person, setPerson] = useState("");
  const [result, setResult] = useState<(Exclude<LoadState, { kind: "loading" }> & { key: string }) | null>(null);
  // Everyone seen in the trail so far, so choosing a person never empties the list of people.
  const [people, setPeople] = useState<AuditPerson[]>([]);
  const [reloads, setReloads] = useState(0);

  const token = useCallback(async (): Promise<string> => {
    if (!user) throw new SevaClientError("unauthenticated", 401, "Sign in again to continue.");
    return user.getIdToken();
  }, [user]);
  const reports = useMemo(() => reportsApi(token), [token]);

  const remember = useCallback((entries: AuditEntry[]) => {
    setPeople((known) => {
      const byId = new Map(known.map((p) => [p.staffId, p]));
      for (const e of entries) {
        if (!e.by || byId.has(e.by.staffId)) continue;
        const name = e.by.name ?? AUDIT.system;
        byId.set(e.by.staffId, { staffId: e.by.staffId, label: e.by.staffNo === null ? name : `${name} (${String(e.by.staffNo).padStart(3, "0")})` });
      }
      return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
    });
  }, []);

  const filter = useMemo(() => ({ type: type === "all" ? undefined : type, staffId: person || undefined }), [type, person]);

  const key = `${type}|${person}|${reloads}`;
  // An answer for another filter than the one on screen means the new one is still loading.
  const state: LoadState = result && result.key === key ? result : { kind: "loading" };

  useEffect(() => {
    let alive = true;
    reports.audit(filter).then(
      (page) => {
        if (!alive) return;
        remember(page.rows);
        setResult({ key, kind: "ready", entries: page.rows, nextCursor: page.nextCursor, more: false });
      },
      (err: unknown) => {
        if (alive) setResult({ key, kind: "error", message: message(err) });
      },
    );
    return () => {
      alive = false;
    };
  }, [reports, filter, remember, key]);

  async function more(): Promise<void> {
    if (state.kind !== "ready" || !state.nextCursor || state.more) return;
    const asked = key;
    const cursor = state.nextCursor;
    const mark = (busy: boolean) =>
      setResult((prev) => (prev && prev.key === asked && prev.kind === "ready" ? { ...prev, more: busy } : prev));
    mark(true);
    try {
      const page = await reports.audit({ ...filter, cursor });
      remember(page.rows);
      setResult((prev) =>
        prev && prev.key === asked && prev.kind === "ready"
          ? { ...prev, entries: [...prev.entries, ...page.rows], nextCursor: page.nextCursor, more: false }
          : prev,
      );
    } catch (err) {
      mark(false);
      toast.error(message(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Bilingual as="h2" en={AUDIT.heading.en} kn={AUDIT.heading.kn} className="text-(length:--text-h3) font-semibold text-(--foreground)" />
        <Bilingual as="div" en={AUDIT.intro.en} kn={AUDIT.intro.kn} className="text-(length:--text-meta) text-(--muted-foreground)" />
      </div>
      {state.kind === "error" ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="font-semibold text-(--destructive)">{state.message}</p>
          <Button variant="seva-secondary" onClick={() => setReloads((n) => n + 1)}>
            {REPORTS.tryAgain}
          </Button>
        </div>
      ) : (
        <>
          {state.kind === "loading" ? (
            <div role="status" className="text-center">
              <Bilingual en={REPORTS.loading.en} kn={REPORTS.loading.kn} className="text-(length:--text-meta) text-(--muted-foreground)" />
            </div>
          ) : null}
          <AuditTrail
            entries={state.kind === "ready" ? state.entries : []}
            type={type}
            onType={setType}
            person={person}
            people={people}
            onPerson={setPerson}
            loading={state.kind === "loading"}
            hasMore={state.kind === "ready" && state.nextCursor !== null}
            loadingMore={state.kind === "ready" && state.more}
            onMore={() => void more()}
          />
        </>
      )}
    </div>
  );
}

/** Reports - Audit trail (DB §12.4): who changed money or rules, when and why, newest first. */
export default function AuditPage(): JSX.Element {
  return (
    <SevaGate action="reports.view">
      <AuditScreen />
    </SevaGate>
  );
}
