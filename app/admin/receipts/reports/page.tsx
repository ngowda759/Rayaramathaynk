"use client";

import { useCallback, useEffect, useId, useMemo, useState, type JSX } from "react";

import { SevaSummary, summaryRange } from "@/components/seva/reports/SevaSummary";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Segmented } from "@/components/seva/ui/Segmented";
import { Button } from "@/components/ui/button";
import { sevaControlClass } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { REPORTS, SUMMARY, type SummaryRange } from "@/lib/seva/strings/reports";
import { businessDate } from "@/lib/seva/time";
import { SevaClientError } from "@/services/seva/http";
import { reportsApi, type SevaSummaryReport } from "@/services/seva/reports.service";

type LoadState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; report: SevaSummaryReport; asOf: string };

function SummaryScreen(): JSX.Element {
  const { user } = useAuth();
  const id = useId();
  const today = useMemo(() => businessDate(new Date()), []);
  const [range, setRange] = useState<SummaryRange>("month");
  const [custom, setCustom] = useState(() => summaryRange("month", today));
  const [result, setResult] = useState<(Exclude<LoadState, { kind: "loading" }> & { key: string }) | null>(null);
  const [reloads, setReloads] = useState(0);

  const token = useCallback(async (): Promise<string> => {
    if (!user) throw new SevaClientError("unauthenticated", 401, "Sign in again to continue.");
    return user.getIdToken();
  }, [user]);
  const reports = useMemo(() => reportsApi(token), [token]);
  const span = range === "custom" ? custom : summaryRange(range, today);

  const spanOk = span.from !== "" && span.to !== "" && span.from <= span.to;
  const key = `${span.from}|${span.to}|${reloads}`;
  // An answer for another range than the one on screen means the new one is still loading.
  const state: LoadState = result && result.key === key ? result : { kind: "loading" };

  useEffect(() => {
    if (!spanOk) return undefined;
    let alive = true;
    reports.sevaSummary(span.from, span.to).then(
      (report) => {
        if (alive) setResult({ key, kind: "ready", report, asOf: new Date().toISOString() });
      },
      (err: unknown) => {
        if (alive) setResult({ key, kind: "error", message: err instanceof Error ? err.message : String(err) });
      },
    );
    return () => {
      alive = false;
    };
  }, [reports, spanOk, span.from, span.to, key]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Bilingual as="h2" en={SUMMARY.heading.en} kn={SUMMARY.heading.kn} className="text-(length:--text-h3) font-semibold text-(--foreground)" />
        <div className="overflow-x-auto">
          <Segmented
            name={`${id}-range`}
            label={SUMMARY.rangeLabel}
            options={SUMMARY.ranges.map((r) => ({ value: r.value, en: r.en }))}
            value={range}
            onChange={(next) => {
              if (next === "custom" && range !== "custom") setCustom(summaryRange(range, today));
              setRange(next);
            }}
          />
        </div>
        {range === "custom" ? (
          <div className="grid max-w-md grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Bilingual as="label" htmlFor={`${id}-from`} en={SUMMARY.from.en} kn={SUMMARY.from.kn} className="text-(length:--text-meta) font-semibold" />
              <input
                id={`${id}-from`}
                type="date"
                value={custom.from}
                max={custom.to || undefined}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                className={sevaControlClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Bilingual as="label" htmlFor={`${id}-to`} en={SUMMARY.to.en} kn={SUMMARY.to.kn} className="text-(length:--text-meta) font-semibold" />
              <input
                id={`${id}-to`}
                type="date"
                value={custom.to}
                min={custom.from || undefined}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                className={sevaControlClass}
              />
            </div>
          </div>
        ) : null}
      </div>

      {state.kind === "loading" && spanOk ? (
        <div role="status" className="py-8 text-center">
          <Bilingual en={REPORTS.loading.en} kn={REPORTS.loading.kn} className="text-(--muted-foreground)" />
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
      {state.kind === "ready" ? <SevaSummary report={state.report} asOf={state.asOf} /> : null}
    </div>
  );
}

/** Reports - Seva summary (DB §12.4): count and amount per seva by seva date, against the same days last year. */
export default function SevaSummaryPage(): JSX.Element {
  return (
    <SevaGate action="reports.view">
      <SummaryScreen />
    </SevaGate>
  );
}
