"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { AnimatePresence, m } from "framer-motion";

import { StepPane } from "@/components/seva/counter/StepPane";
import { CashCount, cashDifference, countedPaise, denominationKey, hasInvalidCount, noteIsEnough, parseCount } from "@/components/seva/dayclose/CashCount";
import { printDayCloseSummary, type DayCloseSummaryModel } from "@/components/seva/dayclose/DayCloseSummaryPrint";
import { SentCheck } from "@/components/seva/dayclose/SentCheck";
import { SeriesSummary } from "@/components/seva/dayclose/SeriesSummary";
import { parseRupeeText, UpiCheck, upiDifference } from "@/components/seva/dayclose/UpiCheck";
import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Reveal } from "@/components/seva/motion/Reveal";
import { SevaLink } from "@/components/seva/motion/SevaLink";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { sevaControlClass } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { issuedToExportRow } from "@/lib/seva/excel/copyScheduler";
import { buildDayWorkbookBytes, dayExcelFileName } from "@/lib/seva/excel/download";
import { writeDayCopy } from "@/lib/seva/excel/folder";
import { isUnreachable } from "@/lib/seva/offline/connection";
import { openSevaDb, type SevaDb } from "@/lib/seva/offline/db";
import { deviceHeader, getDeviceCredentials } from "@/lib/seva/offline/device";
import { COUNTER_APP_VERSION } from "@/lib/seva/offline/heartbeat";
import { slideIn } from "@/lib/seva/motion";
import { pruneClosedDays, todaysReceipts } from "@/lib/seva/offline/local-receipts";
import { pendingCount } from "@/lib/seva/offline/outbox";
import { runSync } from "@/lib/seva/offline/sync";
import { closedAtLine, DAYCLOSE, dayLine } from "@/lib/seva/strings/dayclose";
import { businessDate, formatSevaDate } from "@/lib/seva/time";
import { counterApi } from "@/services/seva/counter.service";
import { dayCloseApi } from "@/services/seva/dayclose.service";
import { SevaClientError } from "@/services/seva/http";
import { reportsApi } from "@/services/seva/reports.service";
import type { Bi } from "@/lib/seva/strings/common";
import type { DayClosePrep } from "@/types/seva-dayclose";

/**
 * Close day (DB §9.10, C-24 to C-26; mockup counter.html#dayclose). Steps in order: 1 cash counted by denomination,
 * 2 its difference (a note when not zero), 3 UPI against the bank app, 4 "Nothing is waiting to send" (the counter PC
 * sends a heartbeat first), 5 receipt numbers per series, 6 close: the office writes the close, then this page prints
 * the summary, saves the day's Excel copy and removes this PC's local receipts of earlier days that are already sent,
 * 7 a closed day shows "Day closed" and temple admins can reopen it with a reason. The maths is the server's
 * (`seva_prepare_day_close`, `seva_close_day`); the page only shows it and checks the form before sending.
 *
 * Query: `?counterId&date` (admins, from Reports - Day closes); without them the counter PC's own counter, today.
 *
 * "This PC" counts as the counter being closed only when it holds device credentials AND the counter asked for is the
 * device's own (`me.counter`, verified by the device header). Only then does the page use this PC's outbox, heartbeat,
 * "Send now", Excel copy and pruning; for any other counter it shows the office's figures and makes no copy here.
 *
 * Motion (plan A4P-2): the amounts count to their values, Close and Reopen answer the click at once with their
 * pending words, and moving from the count to "Day closed" (and back after a reopen) slides.
 */

type Phase = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; prep: DayClosePrep };

interface Local {
  db: SevaDb | null;
  header: string | null;
}

function errorMessage(err: unknown): string {
  return err instanceof SevaClientError ? err.message : DAYCLOSE.loadFailed.en;
}

function BiLine({ text, className }: { text: Bi; className?: string }): JSX.Element {
  return <Bilingual as="div" en={text.en} kn={text.kn} className={className} />;
}

interface DayApis {
  dayClose: ReturnType<typeof dayCloseApi>;
  counter: ReturnType<typeof counterApi>;
}

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Hands already-built workbook bytes to the browser's downloads (no second build). */
function downloadBytes(bytes: ArrayBuffer, meta: { date: string; counterName: string }): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_TYPE }));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = dayExcelFileName(meta);
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/**
 * One load of the day: when this PC is the counter being closed, a heartbeat with this PC's outbox count first (so
 * the office's count is current, DB §9.10 step 4), then the office's figures. `waiting` is this PC's own count there,
 * else the office's count for that counter.
 */
async function loadDay(
  local: Local,
  thisCounter: boolean,
  apis: DayApis,
  q: { counterId?: number; date?: string },
): Promise<{ phase: Phase; waiting: number | null; offline: boolean }> {
  let localWaiting: number | null = null;
  let reached = true;
  if (local.db && thisCounter) {
    try {
      localWaiting = await pendingCount(local.db);
      await apis.counter.heartbeat({ outboxCount: localWaiting, clockSkewMs: 0, appVersion: COUNTER_APP_VERSION });
    } catch (err) {
      if (isUnreachable(err)) reached = false;
    }
  }
  try {
    const prep = await apis.dayClose.prepare(q);
    return { phase: { kind: "ready", prep }, waiting: localWaiting ?? prep.outboxPending, offline: false };
  } catch (err) {
    return { phase: { kind: "error", message: errorMessage(err) }, waiting: null, offline: !reached || isUnreachable(err) };
  }
}

function DayCloseScreen(): JSX.Element {
  const { me, can } = useSevaMe();
  const { user } = useAuth();
  const params = useSearchParams();
  const queryCounter = params.get("counterId");
  const queryDate = params.get("date");

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [local, setLocal] = useState<Local | null>(null);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [bankText, setBankText] = useState("");
  const [busy, setBusy] = useState<"close" | "send" | "reopen" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [closedNotes, setClosedNotes] = useState<Bi[]>([]);
  const [lastClose, setLastClose] = useState<{ id: string; counterId: number; date: string } | null>(null);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reloads, setReloads] = useState(0);
  const dbRef = useRef<SevaDb | null>(null);

  const token = useCallback(async (): Promise<string> => {
    if (!user) throw new SevaClientError("unauthenticated", 401, "Sign in again.");
    return user.getIdToken();
  }, [user]);

  const header = local?.header ?? null;
  const apis = useMemo(
    () => ({
      dayClose: dayCloseApi(token, () => header),
      counter: counterApi(token, () => header),
      reports: reportsApi(token),
    }),
    [token, header],
  );

  // This PC's counter database and device credentials (none on an office PC, or where IndexedDB is unavailable).
  useEffect(() => {
    let alive = true;
    void (async () => {
      let db: SevaDb | null = null;
      let found: string | null = null;
      try {
        db = await openSevaDb();
        const credentials = await getDeviceCredentials(db);
        found = credentials ? deviceHeader(credentials) : null;
      } catch {
        db = null;
      }
      if (!alive) {
        db?.close();
        return;
      }
      dbRef.current = db;
      setLocal({ db, header: found });
    })();
    return () => {
      alive = false;
      dbRef.current?.close();
      dbRef.current = null;
    };
  }, []);

  const counterId = queryCounter && /^\d{1,2}$/.test(queryCounter) ? Number(queryCounter) : undefined;
  const date = queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate) ? queryDate : undefined;
  const fallbackCounter = me?.counter?.id;
  const noCounter = local !== null && counterId === undefined && !local.header && fallbackCounter === undefined;
  // This PC is the counter being closed: it has device credentials and no other counter was asked for.
  const thisCounterAsked = Boolean(local?.header) && (counterId === undefined || fallbackCounter === counterId);
  const meKnown = me !== null && me !== undefined;

  useEffect(() => {
    // Runs once the local database and the person are known, again when the query changes, and on every reload.
    if (!local || !meKnown || noCounter) return;
    let alive = true;
    const q = { counterId: counterId ?? (local.header ? undefined : fallbackCounter), date };
    void loadDay(local, thisCounterAsked, apis, q).then((result) => {
      if (!alive) return;
      setOffline(result.offline);
      setWaiting(result.waiting);
      setPhase(result.phase);
    });
    return () => {
      alive = false;
    };
  }, [local, meKnown, thisCounterAsked, apis, counterId, date, fallbackCounter, noCounter, reloads]);

  const reload = (): void => setReloads((n) => n + 1);

  const retry = (): void => {
    setPhase({ kind: "loading" });
    reload();
  };

  if (noCounter) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <BiLine text={DAYCLOSE.noCounter} className="text-(--muted-foreground)" />
      </div>
    );
  }

  if (phase.kind === "loading" || !me) {
    return (
      <div role="status" aria-live="polite" className="p-6">
        <Bilingual en={DAYCLOSE.loading.en} kn={DAYCLOSE.loading.kn} className="text-(--muted-foreground)" />
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center">
        <p className="font-semibold">{phase.message}</p>
        {offline ? <BiLine text={DAYCLOSE.whyOffline} className="text-(--muted-foreground)" /> : null}
        <Button variant="seva-primary" onClick={retry}>
          {DAYCLOSE.tryAgain.en}
        </Button>
      </div>
    );
  }

  const prep = phase.prep;
  const counterName = me.counter && me.counter.id === prep.counterId ? me.counter.name : `Counter ${prep.counterId}`;
  const closed = prep.status === "closed";
  const isThisCounter = thisCounterAsked && (me.counter ? me.counter.id === prep.counterId : counterId === undefined);
  const thisDb = isThisCounter ? (local?.db ?? null) : null;

  const counted = countedPaise(prep.denominations, counts);
  const cashDiff = cashDifference(counted, prep.cashExpectedPaise);
  const bankPaise = parseRupeeText(bankText);
  const upiDiff = upiDifference(bankText, prep.upiExpectedPaise);
  const differs = cashDiff.kind !== "balanced" || (upiDiff !== null && upiDiff.kind !== "balanced");
  const upiMissing = prep.upiCount > 0 && (bankPaise === null || Number.isNaN(bankPaise));

  let blocker: Bi | null = null;
  // Just closed here: the Close button stays off until the reload brings back the closed day.
  if (lastClose && lastClose.counterId === prep.counterId && lastClose.date === prep.businessDate) blocker = DAYCLOSE.closing;
  else if (waiting === null || waiting > 0) blocker = DAYCLOSE.whyWaiting;
  else if (hasInvalidCount(prep.denominations, counts)) blocker = DAYCLOSE.whyCounts;
  else if (upiMissing) blocker = DAYCLOSE.whyUpi;
  else if (differs && !noteIsEnough(note)) blocker = DAYCLOSE.whyNote;

  const sendNow = async (): Promise<void> => {
    if (!thisDb) return;
    setBusy("send");
    setActionError(null);
    try {
      await runSync({ db: thisDb, api: apis.counter });
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(null);
    }
    reload();
  };

  /**
   * The day's Excel copy (DB §9.11), made only on this counter's own PC for its own business day: an earlier day's
   * local receipts may already be pruned, and an empty or partial workbook must never replace the folder's good copy.
   */
  const saveExcelCopy = async (day: string): Promise<Bi> => {
    if (!thisDb) return DAYCLOSE.excelNone;
    if (day !== businessDate(new Date())) return DAYCLOSE.excelNotToday;
    try {
      const receipts = await todaysReceipts(thisDb, day);
      if (receipts.length === 0) return DAYCLOSE.excelNone;
      const meta = { date: day, counterName };
      const bytes = await buildDayWorkbookBytes(receipts.map(issuedToExportRow), meta);
      const written = await writeDayCopy(thisDb, day, bytes);
      if (written === "written") return DAYCLOSE.excelWritten;
      downloadBytes(bytes, meta);
      return written === "needs_permission" ? DAYCLOSE.excelNeedsPermission : DAYCLOSE.excelDownloaded;
    } catch {
      return DAYCLOSE.excelFailed;
    }
  };

  const closeDay = async (): Promise<void> => {
    if (blocker) return;
    setBusy("close");
    setActionError(null);
    const rows = prep.denominations.map((d) => ({
      kind: d.kind,
      valuePaise: d.valuePaise,
      count: parseCount(counts[denominationKey(d.kind, d.valuePaise)] ?? "") ?? 0,
    }));
    const upiBankTotalPaise = bankPaise === null || Number.isNaN(bankPaise) ? null : bankPaise;
    let dayCloseId: string;
    try {
      ({ dayCloseId } = await apis.dayClose.close({
        counterId: prep.counterId,
        businessDate: prep.businessDate,
        counts: rows,
        upiBankTotalPaise,
        note: note.trim() ? note.trim() : undefined,
      }));
    } catch (err) {
      setBusy(null);
      setActionError(errorMessage(err));
      return;
    }

    setLastClose({ id: dayCloseId, counterId: prep.counterId, date: prep.businessDate });
    const closedAt = new Date().toISOString();
    const notesAfter: Bi[] = [];
    const model: DayCloseSummaryModel = {
      counterName,
      businessDate: prep.businessDate,
      closedAt,
      closedBy: `${me.name} (${me.staffNo})`,
      receipts: prep.receipts,
      cancelled: prep.cancelled,
      changed: prep.changed,
      openingFloatPaise: prep.openingFloatPaise,
      cashExpectedPaise: prep.cashExpectedPaise,
      cashCountedPaise: counted,
      counts: rows.filter((r) => r.count > 0),
      upiCount: prep.upiCount,
      upiExpectedPaise: prep.upiExpectedPaise,
      upiBankTotalPaise,
      note: note.trim() ? note.trim() : null,
      seriesRanges: prep.seriesRanges,
    };
    try {
      await printDayCloseSummary(model);
    } catch {
      notesAfter.push(DAYCLOSE.printFailed);
    }
    notesAfter.push(await saveExcelCopy(prep.businessDate));
    if (thisDb) {
      // Earlier days' receipts the office already has are no longer needed on this PC (DB §9.11).
      await pruneClosedDays(thisDb, prep.businessDate).catch(() => undefined);
    }

    const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true })
      .format(new Date(closedAt))
      .toUpperCase();
    setClosedNotes([closedAtLine(time), ...notesAfter]);
    setCounts({});
    setNote("");
    setBankText("");
    setBusy(null);
    reload();
  };

  const reopen = async (): Promise<void> => {
    if (reason.trim().length < 3) return;
    setBusy("reopen");
    setActionError(null);
    try {
      let id =
        lastClose && lastClose.counterId === prep.counterId && lastClose.date === prep.businessDate ? lastClose.id : null;
      if (!id) {
        const rows = await apis.reports.dayCloses(prep.businessDate, prep.businessDate);
        id = rows.find((r) => r.counterId === prep.counterId && r.status === "closed")?.id ?? null;
      }
      if (!id) {
        setActionError(DAYCLOSE.reopenNotFound.en);
        return;
      }
      await apis.dayClose.reopen(id, reason.trim());
      setReopenOpen(false);
      setReason("");
      setClosedNotes([DAYCLOSE.reopened]);
      setLastClose(null);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const day = dayLine({ counter: counterName, date: formatSevaDate(prep.businessDate), receipts: prep.receipts });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-(length:--text-h1) font-semibold">
            {DAYCLOSE.title.en} - {counterName}
            <span className="kn" lang="kn">
              {DAYCLOSE.title.kn}
            </span>
          </h1>
          <BiLine text={day} className="text-(length:--text-meta) text-(--muted-foreground)" />
        </div>
        <SevaLink href="/admin/receipts/counter" className="text-(length:--text-ui) text-(--link) underline">
          {DAYCLOSE.backToCounter.en}
        </SevaLink>
      </div>

      {closedNotes.length > 0 ? (
        <Reveal
          key={closedNotes.map((n) => n.en).join("|")}
          role="status"
          className="flex flex-col gap-1 rounded-(--radius-card) border border-(--border) bg-(--ok-soft) p-4"
          data-testid="dc-done"
        >
          {closedNotes.map((n) => (
            <BiLine key={n.en} text={n} />
          ))}
        </Reveal>
      ) : null}

      {actionError ? (
        <p role="alert" className="rounded-(--radius-card) bg-(--destructive-soft) p-3 font-semibold text-(--destructive)">
          {actionError}
        </p>
      ) : null}

      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false}>
          {closed ? (
            <StepPane
              key="closed"
              role="region"
              aria-label={DAYCLOSE.dayClosed.en}
              className="flex flex-col gap-3 rounded-(--radius-card) border border-(--border) bg-(--card) p-5 shadow-(--shadow-card)"
            >
              <Bilingual as="h2" en={DAYCLOSE.dayClosed.en} kn={DAYCLOSE.dayClosed.kn} className="text-(length:--text-h2) font-semibold" />
              <BiLine text={DAYCLOSE.dayClosedHint} className="text-(--muted-foreground)" />
              {can("dayclose.reopen") ? (
                reopenOpen ? (
                  <m.div variants={slideIn} initial="hidden" animate="shown" className="flex max-w-lg flex-col gap-2">
                    <Bilingual as="label" htmlFor="dc-reopen-reason" en={DAYCLOSE.reopenReason.en} kn={DAYCLOSE.reopenReason.kn} className="text-(length:--text-meta) font-semibold" />
                    <textarea
                      id="dc-reopen-reason"
                      className={`${sevaControlClass} h-auto min-h-20 py-2.5`}
                      value={reason}
                      maxLength={500}
                      aria-describedby="dc-reopen-hint"
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <span id="dc-reopen-hint" className="text-(length:--text-meta) text-(--muted-foreground)">
                      {DAYCLOSE.reopenReasonHint.en}
                    </span>
                    <div className="flex gap-2">
                      <PendingButton
                        variant="seva-primary"
                        pending={busy === "reopen"}
                        pendingLabel={DAYCLOSE.reopening.en}
                        disabled={reason.trim().length < 3}
                        action={reopen}
                      >
                        {DAYCLOSE.reopenConfirm.en}
                      </PendingButton>
                      <Button variant="seva-ghost" disabled={busy === "reopen"} onClick={() => setReopenOpen(false)}>
                        {DAYCLOSE.cancel.en}
                      </Button>
                    </div>
                  </m.div>
                ) : (
                  <div>
                    <Button variant="seva-secondary" onClick={() => setReopenOpen(true)}>
                      {DAYCLOSE.reopen.en}
                    </Button>
                  </div>
                )
              ) : null}
              <SeriesSummary ranges={prep.seriesRanges} />
            </StepPane>
          ) : (
            <StepPane key="open" className="flex flex-col gap-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <CashCount
                  denominations={prep.denominations}
                  expectedPaise={prep.cashExpectedPaise}
                  counts={counts}
                  onCountChange={(key, value) => setCounts((c) => ({ ...c, [key]: value }))}
                  note={note}
                  onNoteChange={setNote}
                  canManageDenominations={can("settings.edit")}
                  otherDifference={upiDiff !== null && upiDiff.kind !== "balanced"}
                  disabled={busy === "close"}
                />
                <div className="flex flex-col gap-6">
                  <UpiCheck
                    upiCount={prep.upiCount}
                    expectedPaise={prep.upiExpectedPaise}
                    bankText={bankText}
                    onBankChange={setBankText}
                    disabled={busy === "close"}
                  />
                  <SentCheck waiting={waiting} canSend={thisDb !== null} sending={busy === "send"} onSendNow={() => void sendNow()} />
                  <SeriesSummary ranges={prep.seriesRanges} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <PendingButton
                  variant="seva-primary"
                  className="h-14 px-8 text-(length:--text-body-lg)"
                  disabled={blocker !== null}
                  pending={busy === "close"}
                  pendingLabel={DAYCLOSE.closing.en}
                  aria-describedby={blocker ? "dc-why" : undefined}
                  action={closeDay}
                >
                  {DAYCLOSE.closeButton.en}
                </PendingButton>
                {blocker ? (
                  <span id="dc-why" className="text-(length:--text-meta) text-(--muted-foreground)">
                    {blocker.en}
                  </span>
                ) : null}
              </div>
            </StepPane>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function DayClosePage(): JSX.Element {
  return (
    <SevaGate action="dayclose.close">
      <Suspense fallback={null}>
        <DayCloseScreen />
      </Suspense>
    </SevaGate>
  );
}
