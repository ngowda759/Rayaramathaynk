"use client";

import { useCallback, useEffect, useId, useMemo, useState, type JSX } from "react";

import { DayCloseDetail } from "@/components/seva/reports/DayCloseDetail";
import { DayCloseList } from "@/components/seva/reports/DayCloseList";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { sevaControlClass } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { DAY_CLOSES, REGISTER, REPORTS } from "@/lib/seva/strings/reports";
import { addDays, businessDate } from "@/lib/seva/time";
import { SevaClientError } from "@/services/seva/http";
import { reportsApi, type DayCloseListRow } from "@/services/seva/reports.service";

/** The list opens on the last 30 days (IST), today included. */
const DEFAULT_DAYS = 30;

type LoadState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; rows: DayCloseListRow[] };

function DayClosesScreen(): JSX.Element {
  const { user } = useAuth();
  const id = useId();
  const today = useMemo(() => businessDate(new Date()), []);
  const [range, setRange] = useState(() => ({ from: addDays(today, -(DEFAULT_DAYS - 1)), to: today }));
  const [result, setResult] = useState<(Exclude<LoadState, { kind: "loading" }> & { key: string }) | null>(null);
  const [open, setOpen] = useState<DayCloseListRow | null>(null);
  const [reloads, setReloads] = useState(0);

  const token = useCallback(async (): Promise<string> => {
    if (!user) throw new SevaClientError("unauthenticated", 401, "Sign in again to continue.");
    return user.getIdToken();
  }, [user]);
  const reports = useMemo(() => reportsApi(token), [token]);

  const rangeOk = range.from !== "" && range.to !== "" && range.from <= range.to;
  const key = `${range.from}|${range.to}|${reloads}`;
  // An answer for another range than the one on screen means the new one is still loading.
  const state: LoadState = result && result.key === key ? result : { kind: "loading" };

  useEffect(() => {
    if (!rangeOk) return undefined;
    let alive = true;
    reports.dayCloses(range.from, range.to).then(
      (rows) => {
        if (alive) setResult({ key, kind: "ready", rows });
      },
      (err: unknown) => {
        if (alive) setResult({ key, kind: "error", message: err instanceof Error ? err.message : String(err) });
      },
    );
    return () => {
      alive = false;
    };
  }, [reports, rangeOk, range.from, range.to, key]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid max-w-md grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Bilingual as="label" htmlFor={`${id}-from`} en={REGISTER.from.en} kn={REGISTER.from.kn} className="text-(length:--text-meta) font-semibold" />
          <input
            id={`${id}-from`}
            type="date"
            value={range.from}
            max={range.to || undefined}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className={sevaControlClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Bilingual as="label" htmlFor={`${id}-to`} en={REGISTER.to.en} kn={REGISTER.to.kn} className="text-(length:--text-meta) font-semibold" />
          <input
            id={`${id}-to`}
            type="date"
            value={range.to}
            min={range.from || undefined}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className={sevaControlClass}
          />
        </div>
      </div>

      {state.kind === "loading" && rangeOk ? (
        <div role="status" className="py-8 text-center">
          <Bilingual en={DAY_CLOSES.loading.en} kn={DAY_CLOSES.loading.kn} className="text-(--muted-foreground)" />
        </div>
      ) : null}
      {state.kind === "error" ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="font-semibold text-(--destructive)">{state.message}</p>
          <Button variant="seva-secondary" onClick={() => setReloads((n) => n + 1)}>
            {REPORTS.tryAgain}
          </Button>
        </div>
      ) : null}
      {state.kind === "ready" ? <DayCloseList rows={state.rows} onOpen={setOpen} /> : null}

      <DayCloseDetail row={open} onClose={() => setOpen(null)} />
    </div>
  );
}

/** Day closes (DB §12.4): balanced, short and extra closes per counter per day, each with its detail. */
export default function DayClosesPage(): JSX.Element {
  return (
    <SevaGate action="reports.view">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-1">
          <Bilingual as="h1" en={DAY_CLOSES.heading.en} kn={DAY_CLOSES.heading.kn} className="text-(length:--text-h2) font-semibold text-(--foreground)" />
          <Bilingual as="div" en={DAY_CLOSES.intro.en} kn={DAY_CLOSES.intro.kn} className="text-(length:--text-meta) text-(--muted-foreground)" />
        </div>
        <DayClosesScreen />
      </main>
    </SevaGate>
  );
}
