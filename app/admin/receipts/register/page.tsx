"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState, type JSX } from "react";
import toast from "react-hot-toast";

import { ContinuityCard } from "@/components/seva/register/ContinuityCard";
import { GapResolveDialog } from "@/components/seva/register/GapResolveDialog";
import { ReceiptCards } from "@/components/seva/register/ReceiptCards";
import { ReceiptDrawer } from "@/components/seva/register/ReceiptDrawer";
import { RegisterFilters, filtersFromSearch, toListParams, type RegisterFilterValue } from "@/components/seva/register/RegisterFilters";
import { RegisterTable } from "@/components/seva/register/RegisterTable";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import type { GapResolveRequest } from "@/lib/seva/schemas";
import { CONTINUITY, GAP_DIALOG, REGISTER } from "@/lib/seva/strings/reports";
import { businessDate, formatSevaDate } from "@/lib/seva/time";
import { catalogueApi } from "@/services/seva/catalogue.service";
import { SevaClientError } from "@/services/seva/http";
import { receiptsApi, type ReceiptListParams } from "@/services/seva/receipts.service";
import { reportsApi } from "@/services/seva/reports.service";
import type { CatalogueSeva } from "@/types/seva";
import type { ReceiptListItem } from "@/types/seva-receipts";
import type { ContinuityGap, ContinuityRow } from "@/types/seva-reports";

/** Typing in the search box waits this long before asking the office. */
const SEARCH_DEBOUNCE_MS = 300;

type ListState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; rows: ReceiptListItem[]; nextCursor: string | null; more: boolean };

/** An answer and the query it answers; a different query on screen means its answer is still loading. */
type Keyed<T> = T & { key: string };
type ContinuityState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; rows: ContinuityRow[] };

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function rangeLabel(from: string, to: string, today: string): string {
  if (from === to) return from === today ? "today" : formatSevaDate(from);
  return `${formatSevaDate(from)} - ${formatSevaDate(to)}`;
}

/** A filter value whose search text has settled (the other filters apply at once). */
function useSettled(filters: RegisterFilterValue): RegisterFilterValue {
  const [settledQ, setSettledQ] = useState(filters.q);
  useEffect(() => {
    const timer = setTimeout(() => setSettledQ(filters.q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.q]);
  return useMemo(() => ({ ...filters, q: settledQ }), [filters, settledQ]);
}

function RegisterScreen(): JSX.Element {
  const { user } = useAuth();
  const { can } = useSevaMe();
  const params = useSearchParams();
  const today = useMemo(() => businessDate(new Date()), []);
  const [filters, setFilters] = useState<RegisterFilterValue>(() => filtersFromSearch(params, today));
  const settled = useSettled(filters);

  const [listResult, setListResult] = useState<Keyed<Exclude<ListState, { kind: "loading" }>> | null>(null);
  const [continuityResult, setContinuityResult] = useState<Keyed<Exclude<ContinuityState, { kind: "loading" }>> | null>(null);
  const [sevas, setSevas] = useState<CatalogueSeva[]>([]);
  const [openRow, setOpenRow] = useState<ReceiptListItem | null>(null);
  const [gap, setGap] = useState<ContinuityGap | null>(null);
  const [gapBusy, setGapBusy] = useState(false);
  const [gapError, setGapError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  const token = useCallback(async (): Promise<string> => {
    if (!user) throw new SevaClientError("unauthenticated", 401, "Sign in again to continue.");
    return user.getIdToken();
  }, [user]);
  const receipts = useMemo(() => receiptsApi(token, () => null), [token]);
  const reports = useMemo(() => reportsApi(token), [token]);
  const canResolve = can("gap.resolve");

  // The seva choices for the filter; without them the filter still offers "All sevas".
  useEffect(() => {
    let alive = true;
    catalogueApi(token)
      .list()
      .then(
        (all) => {
          // A malformed answer leaves the choice at "All sevas" rather than breaking the page.
          if (alive && Array.isArray(all)) setSevas([...all].sort((a, b) => a.key - b.key));
        },
        () => undefined,
      );
    return () => {
      alive = false;
    };
  }, [token]);

  // Keyed on the query text, so typing that has not settled yet never asks the office again.
  const paramsText = JSON.stringify(toListParams(settled));
  const listParams = useMemo(() => JSON.parse(paramsText) as ReceiptListParams, [paramsText]);
  const listKey = `${paramsText}|${reloads}`;
  const list: ListState = listResult && listResult.key === listKey ? listResult : { kind: "loading" };
  const rangeOk = settled.from !== "" && settled.to !== "" && settled.from <= settled.to;
  const continuityKey = `${settled.from}|${settled.to}|${reloads}`;
  const continuity: ContinuityState =
    continuityResult && continuityResult.key === continuityKey ? continuityResult : { kind: "loading" };

  // The list: page one again whenever a filter changes.
  useEffect(() => {
    let alive = true;
    receipts.list(listParams).then(
      (page) => {
        if (alive) setListResult({ key: listKey, kind: "ready", rows: page.rows, nextCursor: page.nextCursor, more: false });
      },
      (err: unknown) => {
        if (alive) setListResult({ key: listKey, kind: "error", message: errorText(err) });
      },
    );
    return () => {
      alive = false;
    };
  }, [receipts, listParams, listKey]);

  // The continuity card follows the date range only.
  useEffect(() => {
    if (!rangeOk) return undefined;
    let alive = true;
    reports.continuity(settled.from, settled.to).then(
      (rows) => {
        if (alive) setContinuityResult({ key: continuityKey, kind: "ready", rows });
      },
      (err: unknown) => {
        if (alive) setContinuityResult({ key: continuityKey, kind: "error", message: errorText(err) });
      },
    );
    return () => {
      alive = false;
    };
  }, [reports, rangeOk, settled.from, settled.to, continuityKey]);

  async function showMore(): Promise<void> {
    if (list.kind !== "ready" || !list.nextCursor || list.more) return;
    const key = listKey;
    const cursor = list.nextCursor;
    const mark = (more: boolean) =>
      setListResult((prev) => (prev && prev.key === key && prev.kind === "ready" ? { ...prev, more } : prev));
    mark(true);
    try {
      const page = await receipts.list({ ...listParams, cursor });
      setListResult((prev) =>
        prev && prev.key === key && prev.kind === "ready"
          ? { ...prev, rows: [...prev.rows, ...page.rows], nextCursor: page.nextCursor, more: false }
          : prev,
      );
    } catch (err) {
      mark(false);
      toast.error(errorText(err));
    }
  }

  async function resolveGap(choice: GapResolveRequest): Promise<void> {
    if (!gap) return;
    setGapBusy(true);
    setGapError(null);
    try {
      await receipts.resolveGap(gap.id, choice);
      setGap(null);
      toast.success(GAP_DIALOG.done);
      setReloads((n) => n + 1);
    } catch (err) {
      setGapError(errorText(err));
    } finally {
      setGapBusy(false);
    }
  }

  const loadDetail = useCallback((id: string) => receipts.get(id), [receipts]);

  return (
    <div className="flex flex-col gap-4">
      <RegisterFilters value={filters} sevas={sevas} onChange={setFilters} />

      {continuity.kind === "ready" ? (
        <ContinuityCard
          rows={continuity.rows}
          rangeLabel={rangeLabel(settled.from, settled.to, today)}
          canResolve={canResolve}
          onResolve={(g) => {
            setGapError(null);
            setGap(g);
          }}
        />
      ) : continuity.kind === "error" ? (
        <p role="alert" className="text-(length:--text-meta) font-semibold text-(--destructive)">
          {continuity.message}
        </p>
      ) : rangeOk ? (
        <div role="status">
          <Bilingual en={CONTINUITY.loading.en} kn={CONTINUITY.loading.kn} className="text-(length:--text-meta) text-(--muted-foreground)" />
        </div>
      ) : null}

      {list.kind === "loading" ? (
        <div role="status" className="py-8 text-center">
          <Bilingual en={REGISTER.loading.en} kn={REGISTER.loading.kn} className="text-(--muted-foreground)" />
        </div>
      ) : null}
      {list.kind === "error" ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="font-semibold text-(--destructive)">{list.message}</p>
          <Button variant="seva-secondary" onClick={() => setReloads((n) => n + 1)}>
            {REGISTER.tryAgain}
          </Button>
        </div>
      ) : null}
      {list.kind === "ready" && list.rows.length === 0 ? (
        <div className="py-8 text-center">
          <Bilingual en={REGISTER.empty.en} kn={REGISTER.empty.kn} className="text-(--muted-foreground)" />
        </div>
      ) : null}
      {list.kind === "ready" && list.rows.length > 0 ? (
        <>
          <RegisterTable rows={list.rows} today={today} onOpen={setOpenRow} />
          <ReceiptCards rows={list.rows} today={today} onOpen={setOpenRow} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-(length:--text-meta) text-(--muted-foreground)" aria-live="polite">
              {REGISTER.shown(list.rows.length)}
            </span>
            {list.nextCursor ? (
              <Button variant="seva-secondary" onClick={() => void showMore()} loading={list.more}>
                {REGISTER.showMore}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}

      <ReceiptDrawer row={openRow} today={today} load={loadDetail} onClose={() => setOpenRow(null)} />
      <GapResolveDialog
        gap={gap}
        busy={gapBusy}
        error={gapError}
        onConfirm={(choice) => void resolveGap(choice)}
        onClose={() => {
          if (!gapBusy) setGap(null);
        }}
      />
    </div>
  );
}

/**
 * Receipts register (DB §12.3): every receipt number in order with its status, the number continuity card per series,
 * and a drawer with each receipt's history. Filters come from the page's own controls or from a link
 * (`?status=changed|cancelled|duplicate|prasadam_pending|issued&from&to&q`). Temple admins resolve open number gaps here.
 */
export default function RegisterPage(): JSX.Element {
  return (
    <SevaGate action="reports.view">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Bilingual as="h1" en={REGISTER.title.en} kn={REGISTER.title.kn} className="text-(length:--text-h2) font-semibold text-(--foreground)" />
            <Bilingual as="div" en={REGISTER.subtitle.en} kn={REGISTER.subtitle.kn} className="text-(length:--text-meta) text-(--muted-foreground)" />
          </div>
          <Link href="/admin/receipts/reports/export" className={buttonVariants({ variant: "seva-secondary" })}>
            {REGISTER.export}
          </Link>
        </div>
        <Suspense fallback={null}>
          <RegisterScreen />
        </Suspense>
      </main>
    </SevaGate>
  );
}
