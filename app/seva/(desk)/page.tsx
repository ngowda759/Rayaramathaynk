"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition, type JSX } from "react";
import { m } from "framer-motion";

import { DetailCharts } from "@/components/seva/dashboard/DetailCharts";
import { HeroChart } from "@/components/seva/dashboard/HeroChart";
import { NeedsAttention } from "@/components/seva/dashboard/NeedsAttention";
import { PeriodSwitch } from "@/components/seva/dashboard/PeriodSwitch";
import { SummaryTiles } from "@/components/seva/dashboard/SummaryTiles";
import { PageSkeleton } from "@/components/seva/motion/PageSkeleton";
import { PendingButton } from "@/components/seva/motion/PendingButton";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { FALLBACK_CHART_COLORS, readChartColors } from "@/lib/seva/charts/colors";
import { asOfClock } from "@/lib/seva/dashboard/format";
import { SEVA_ROUTES, sevaHomePath } from "@/lib/seva/routes";
import { DASHBOARD } from "@/lib/seva/strings/dashboard";
import { businessDate, formatSevaDate, type Period } from "@/lib/seva/time";
import { SevaClientError } from "@/services/seva/http";
import { reportsApi, type DashboardAnswer } from "@/services/seva/reports.service";
import type { DashboardData } from "@/types/seva-reports";

/**
 * Seva dashboard (`/seva`, DB §12.1; plan Task A4-6). Same order on desktop (1366 px) and phone (390 px):
 * title, date and "as of", the period switch first; Needs attention; the summary tiles; the Collections hero chart;
 * the details. Every number follows the period, which is kept in `?period=` so other screens can link to it.
 * The route's 60-second browser cache keeps switching back and forth quick. Receptionists see only their counter's
 * day, never the dashboard (C-59), so they are sent to the counter. The old Firestore receipt list moved to the
 * register (Task A4-7).
 *
 * Motion (plan A4P-3): the first load shows the dashboard's outline; a period switch moves the switch at once and keeps
 * the previous tiles and charts on screen, dimmed, with a small spinner beside the switch, until the new answer is in
 * (the swap and the URL change run as transitions, so the screen never freezes and is never blank). The spinner follows
 * the request, not the numbers: from the error box, "Try again" or a period switch shows it too, with the box dimmed
 * and its button busy until the answer arrives.
 */

const PERIODS: readonly Period[] = ["today", "week", "month", "year"];

function toPeriod(value: string | null): Period {
  return PERIODS.includes(value as Period) ? (value as Period) : "today";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** The answer has the shape the screen reads (a server of another version could send something else). */
function isDashboardAnswer(value: unknown): value is DashboardAnswer {
  if (!isRecord(value) || !isRecord(value.data) || !Array.isArray(value.attention)) return false;
  const d = value.data;
  return (
    typeof d.asOf === "string" &&
    isRecord(d.tiles) &&
    isRecord(d.hero) &&
    Array.isArray(d.hero.buckets) &&
    Array.isArray(d.hero.prev) &&
    Array.isArray(d.topSevas) &&
    isRecord(d.mode) &&
    Array.isArray(d.rush) &&
    Array.isArray(d.calendar) &&
    Array.isArray(d.festivalDates)
  );
}

/** The last answer, tagged with the request it answers (`period:reload`), so a newer request shows as "Updating". */
type Load =
  | { kind: "loading" }
  | { kind: "ready"; key: string; answer: DashboardAnswer; period: Period }
  | { kind: "error"; key: string; message: string };

function Dashboard(): JSX.Element {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const queryPeriod = toPeriod(params.get("period"));
  // The period just picked shows at once, before the URL catches up; a link or the back button (a new `?period=`)
  // wins over it.
  const [picked, setPicked] = useState<{ period: Period; forQuery: Period } | null>(null);
  const period = picked && picked.forQuery === queryPeriod ? picked.period : queryPeriod;
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [reloads, setReloads] = useState(0);
  // The new answer and the URL change are transitions: the switch answers at once, the old numbers stay meanwhile.
  const [swapping, startSwap] = useTransition();
  const requestKey = `${period}:${reloads}`;
  const refreshing = load.kind === "loading" || load.key !== requestKey;
  const drawn = load.kind !== "loading";
  const [colors, setColors] = useState<string[]>([...FALLBACK_CHART_COLORS]);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Always mounted (the loading outline included), so the colours are read before the first chart draws.
  const rootRef = useRef<HTMLDivElement>(null);

  const token = useCallback(async (): Promise<string> => {
    if (!user) throw new SevaClientError("unauthenticated", 401, "Sign in again.");
    return user.getIdToken();
  }, [user]);
  const api = useMemo(() => reportsApi(token), [token]);
  // Festival peaks on Today, Week or Month shows every day of the year, so its tap asks for the year answer (DB §12.1).
  const loadYear = useCallback(async (): Promise<DashboardData> => {
    const answer: unknown = await api.dashboard("year");
    if (!isDashboardAnswer(answer)) throw new Error(DASHBOARD.badAnswer);
    return answer.data;
  }, [api]);

  // Chart colours come from the module's tokens (DB §12.5); EChart re-reads them on a theme change. Both are read on
  // mount, while the loading outline shows, so the first chart draw already has them.
  useEffect(() => {
    if (rootRef.current) setColors(readChartColors(rootRef.current));
    if (typeof window.matchMedia === "function") setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    const key = `${period}:${reloads}`;
    void (async () => {
      try {
        const answer: unknown = await api.dashboard(period);
        if (!alive) return;
        if (!isDashboardAnswer(answer)) {
          setLoad({ kind: "error", key, message: DASHBOARD.badAnswer });
          return;
        }
        startSwap(() => setLoad({ kind: "ready", key, answer, period }));
      } catch (error) {
        if (!alive) return;
        const message = error instanceof Error && error.message ? error.message : DASHBOARD.loadFailed.en;
        setLoad({ kind: "error", key, message });
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, period, reloads, user]);

  const choosePeriod = useCallback(
    (next: Period) => {
      setPicked({ period: next, forQuery: queryPeriod });
      startSwap(() => {
        router.replace(next === "today" ? SEVA_ROUTES.dashboard : `${SEVA_ROUTES.dashboard}?period=${next}`, { scroll: false });
      });
    },
    [queryPeriod, router],
  );

  const today = formatSevaDate(businessDate(new Date()));
  const ready = load.kind === "ready" ? load : null;
  // A request is on its way (a switch, a retry): the spinner beside the switch shows whatever is on screen.
  const busy = refreshing || swapping;
  // Old numbers on screen, dimmed, while the new ones load.
  const pending = ready !== null && busy;
  const retrying = load.kind === "error" && busy;

  return (
    <div ref={rootRef} className="contents">
      {drawn ? (
        <div
          className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8"
          aria-busy={busy || undefined}
        >
          <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-1">
              <Bilingual as="h1" en={DASHBOARD.title.en} kn={DASHBOARD.title.kn} />
              <p className="meta text-(--muted-foreground)" data-testid="dashboard-as-of">
                {today}
                {ready ? ` · ${DASHBOARD.asOf} ${asOfClock(ready.answer.data.asOf)}` : ""}
                {busy ? ` · ${DASHBOARD.refreshing}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PeriodSwitch value={period} onChange={choosePeriod} pending={busy} />
              <Link href={SEVA_ROUTES.reportsExport} className={buttonVariants({ variant: "seva-ghost" })}>
                {DASHBOARD.export.en}
              </Link>
            </div>
          </header>

          {load.kind === "error" ? (
            <div
              role="alert"
              data-testid="dashboard-error"
              aria-busy={retrying || undefined}
              className={`flex flex-col items-start gap-3 rounded-[18px] border border-(--border) bg-(--destructive-soft) p-5 transition-opacity duration-200 ${retrying ? "opacity-60" : ""}`}
            >
              <p className="font-semibold">{load.message}</p>
              <Bilingual
                as="div"
                en={DASHBOARD.loadFailed.en}
                kn={DASHBOARD.loadFailed.kn}
                className="text-(--muted-foreground)"
              />
              <PendingButton
                variant="seva-primary"
                pending={retrying}
                pendingLabel={DASHBOARD.refreshing}
                onClick={() => setReloads((n) => n + 1)}
              >
                {DASHBOARD.tryAgain}
              </PendingButton>
            </div>
          ) : null}

          {ready ? (
            <m.div
              data-testid="dashboard-content"
              data-pending={pending ? "true" : "false"}
              aria-busy={pending || undefined}
              className="flex flex-col gap-5"
              initial={false}
              animate={{ opacity: pending ? 0.55 : 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <NeedsAttention cards={ready.answer.attention} />
              <SummaryTiles tiles={ready.answer.data.tiles} period={ready.period} />
              <h2 className="sr-only">{DASHBOARD.details}</h2>
              <HeroChart data={ready.answer.data} period={ready.period} colors={colors} reducedMotion={reducedMotion} />
              <DetailCharts
                data={ready.answer.data}
                period={ready.period}
                colors={colors}
                reducedMotion={reducedMotion}
                loadYear={loadYear}
              />
            </m.div>
          ) : null}
        </div>
      ) : (
        // The first answer: the dashboard's outline, the same one the route showed while the page loaded.
        <PageSkeleton variant="dashboard" />
      )}
    </div>
  );
}

/**
 * Opening /seva: a receptionist goes to the counter (C-59) and a prasadam volunteer to the prasadam page (plan A4S-3);
 * everyone else needs `reports.view`.
 */
function DashboardEntry(): JSX.Element {
  const { me } = useSevaMe();
  const router = useRouter();
  const home = sevaHomePath(me?.role);
  const redirecting = me !== null && me !== undefined && home !== SEVA_ROUTES.dashboard;

  useEffect(() => {
    if (me && home !== SEVA_ROUTES.dashboard) router.replace(home);
  }, [me, home, router]);

  // The prasadam page's outline while it opens; the counter keeps its "Opening the counter" line.
  if (redirecting && home !== SEVA_ROUTES.counter) return <PageSkeleton variant="form" />;
  if (redirecting) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center p-6">
        <Bilingual en={DASHBOARD.openingCounter.en} kn={DASHBOARD.openingCounter.kn} className="text-(--muted-foreground)" />
      </div>
    );
  }

  return (
    <SevaGate action="reports.view">
      <Dashboard />
    </SevaGate>
  );
}

export default function ReceiptsDashboardPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <DashboardEntry />
    </Suspense>
  );
}
