"use client";

import { useCallback, useEffect, useId, useMemo, useState, type JSX } from "react";

import { FestivalView } from "@/components/seva/reports/FestivalView";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { sevaControlClass } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { FESTIVAL, REPORTS } from "@/lib/seva/strings/reports";
import { businessDate } from "@/lib/seva/time";
import { SevaClientError } from "@/services/seva/http";
import { reportsApi, type FestivalReport } from "@/services/seva/reports.service";
import { settingsApi } from "@/services/seva/settings.service";
import type { FestivalItem } from "@/types/seva-settings";

type Load<T> = { kind: "loading" } | { kind: "error"; message: string } | ({ kind: "ready" } & T);

/** How many earlier years the compare list offers. */
const COMPARE_YEARS = 3;

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function FestivalScreen(): JSX.Element {
  const { user } = useAuth();
  const id = useId();
  const thisYear = useMemo(() => Number(businessDate(new Date()).slice(0, 4)), []);
  const [festivals, setFestivals] = useState<Load<{ list: FestivalItem[] }>>({ kind: "loading" });
  const [festivalId, setFestivalId] = useState("");
  const [compareYear, setCompareYear] = useState(thisYear - 1);
  const [reportResult, setReportResult] = useState<
    (Exclude<Load<{ report: FestivalReport; asOf: string }>, { kind: "loading" }> & { key: string }) | null
  >(null);
  const [reloads, setReloads] = useState(0);

  const token = useCallback(async (): Promise<string> => {
    if (!user) throw new SevaClientError("unauthenticated", 401, "Sign in again to continue.");
    return user.getIdToken();
  }, [user]);
  const reports = useMemo(() => reportsApi(token), [token]);

  useEffect(() => {
    let alive = true;
    settingsApi(token)
      .listFestivals()
      .then(
        (all) => {
          if (!alive) return;
          // The latest festival first: the one most likely wanted.
          const list = [...all].sort((a, b) => (b.dates[b.dates.length - 1] ?? "").localeCompare(a.dates[a.dates.length - 1] ?? ""));
          setFestivals({ kind: "ready", list });
          setFestivalId((current) => current || list[0]?.id || "");
        },
        (err: unknown) => {
          if (alive) setFestivals({ kind: "error", message: message(err) });
        },
      );
    return () => {
      alive = false;
    };
  }, [token, reloads]);

  const reportKey = `${festivalId}|${compareYear}|${reloads}`;
  // No festival chosen yet: nothing to show. An answer for another choice means the new one is still loading.
  const report: Load<{ report: FestivalReport; asOf: string }> | null = !festivalId
    ? null
    : reportResult && reportResult.key === reportKey
      ? reportResult
      : { kind: "loading" };

  useEffect(() => {
    if (!festivalId) return undefined;
    let alive = true;
    reports.festival(festivalId, compareYear).then(
      (r) => {
        if (alive) setReportResult({ key: reportKey, kind: "ready", report: r, asOf: new Date().toISOString() });
      },
      (err: unknown) => {
        if (alive) setReportResult({ key: reportKey, kind: "error", message: message(err) });
      },
    );
    return () => {
      alive = false;
    };
  }, [reports, festivalId, compareYear, reportKey]);

  const years = Array.from({ length: COMPARE_YEARS }, (_, i) => thisYear - 1 - i);

  return (
    <div className="flex flex-col gap-4">
      <Bilingual as="h2" en={FESTIVAL.heading.en} kn={FESTIVAL.heading.kn} className="text-(length:--text-h3) font-semibold text-(--foreground)" />

      {festivals.kind === "loading" ? (
        <div role="status" className="py-8 text-center">
          <Bilingual en={REPORTS.loading.en} kn={REPORTS.loading.kn} className="text-(--muted-foreground)" />
        </div>
      ) : null}
      {festivals.kind === "error" ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="font-semibold text-(--destructive)">{festivals.message}</p>
          <Button variant="seva-secondary" onClick={() => setReloads((n) => n + 1)}>
            {REPORTS.tryAgain}
          </Button>
        </div>
      ) : null}
      {festivals.kind === "ready" && festivals.list.length === 0 ? (
        <Bilingual as="div" en={FESTIVAL.noFestivals.en} kn={FESTIVAL.noFestivals.kn} className="py-8 text-center text-(--muted-foreground)" />
      ) : null}

      {festivals.kind === "ready" && festivals.list.length > 0 ? (
        <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Bilingual as="label" htmlFor={`${id}-festival`} en={FESTIVAL.festival.en} kn={FESTIVAL.festival.kn} className="text-(length:--text-meta) font-semibold" />
            <select id={`${id}-festival`} value={festivalId} onChange={(e) => setFestivalId(e.target.value)} className={sevaControlClass}>
              {festivals.list.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Bilingual as="label" htmlFor={`${id}-year`} en={FESTIVAL.compareWith.en} kn={FESTIVAL.compareWith.kn} className="text-(length:--text-meta) font-semibold" />
            <select id={`${id}-year`} value={compareYear} onChange={(e) => setCompareYear(Number(e.target.value))} className={sevaControlClass}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {report?.kind === "loading" ? (
        <div role="status" className="py-8 text-center">
          <Bilingual en={REPORTS.loading.en} kn={REPORTS.loading.kn} className="text-(--muted-foreground)" />
        </div>
      ) : null}
      {report?.kind === "error" ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="font-semibold text-(--destructive)">{report.message}</p>
          <Button variant="seva-secondary" onClick={() => setReloads((n) => n + 1)}>
            {REPORTS.tryAgain}
          </Button>
        </div>
      ) : null}
      {report?.kind === "ready" ? <FestivalView report={report.report} asOf={report.asOf} /> : null}
    </div>
  );
}

/** Reports - Festival view (DB §12.4): one festival against an earlier year, with a prasadam planning line. */
export default function FestivalPage(): JSX.Element {
  return (
    <SevaGate action="reports.view">
      <FestivalScreen />
    </SevaGate>
  );
}
