"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type JSX } from "react";

import { CameraScanner } from "@/components/seva/prasadam/CameraScanner";
import { GivenToday, useGivenToday } from "@/components/seva/prasadam/GivenToday";
import { NumberEntry } from "@/components/seva/prasadam/NumberEntry";
import { ResultCard } from "@/components/seva/prasadam/ResultCard";
import { ScanTypeSwitch, type FindMode } from "@/components/seva/prasadam/ScanTypeSwitch";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { useAuth } from "@/hooks/useAuth";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { PRASADAM } from "@/lib/seva/strings/prasadam";
import { businessDate, formatSevaDate } from "@/lib/seva/time";
import { SevaClientError } from "@/services/seva/http";
import { prasadamApi } from "@/services/seva/prasadam.service";
import type { PrasadamLookupResult } from "@/types/seva-prasadam";

/**
 * Prasadam counter (DB §11; plan Task A4-5). Phone first, also a PC with a USB scanner. Scan the slip's QR or type
 * its number; the answer card says what to do. "Mark given" answers `already_given` with `givenNow` on the caller's
 * own give, shown as "Marked given" with Undo for 120 s; `already_given` without it means someone else gave it.
 * No offline mode (C-28). `?token=` (from the public `/r/<token>` page) looks the receipt up at once. No amounts.
 */

type AlreadyGiven = Extract<PrasadamLookupResult, { state: "already_given" }>;

/**
 * The undo time of the person who gave it (DB §11, C-27). The server checks it again against its configurable
 * `seva_settings.prasadam_undo_seconds`; this copy only decides how long the Undo button shows.
 */
const UNDO_MS = 120_000;
/**
 * A QR seen again within this time of its previous sighting is the same slip still in front of the camera and is not
 * looked up again. Out of view for longer, it is looked up again (so a handled slip shown again gets its card).
 */
const REPEAT_SCAN_MS = 3_000;
const MODE_KEY = "seva.prasadam.mode";

function readMode(): FindMode | null {
  try {
    const stored = window.localStorage.getItem(MODE_KEY);
    return stored === "scan" || stored === "type" ? stored : null;
  } catch {
    return null;
  }
}

function saveMode(mode: FindMode): void {
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    // A remembered mode is only a convenience.
  }
}

/** A new card (and a disarmed "Give anyway") for every different answer. */
function resultKey(result: PrasadamLookupResult): string {
  if (result.state === "choose") return `choose:${result.options.map((o) => o.receiptId).join(",")}`;
  if (result.state === "not_found") return `not_found:${result.query}`;
  return `${result.state}:${result.receipt.id}`;
}

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function isConnectionError(error: unknown): boolean {
  return error instanceof SevaClientError && (error.code === "network" || error.code === "timeout");
}

export default function PrasadamPage(): JSX.Element {
  return (
    <SevaGate action="prasadam.give">
      <PrasadamCounter />
    </SevaGate>
  );
}

function PrasadamCounter(): JSX.Element {
  const { user } = useAuth();
  const { me } = useSevaMe();
  const api = useMemo(
    () =>
      prasadamApi(async () => {
        if (!user) throw new SevaClientError("unauthenticated", 401, "Sign in again to use the prasadam counter.");
        return user.getIdToken();
      }),
    [user],
  );
  const given = useGivenToday(me?.staffId ?? null);

  // This page renders only in the browser (SevaGate waits for the profile), so the remembered mode is read at once.
  const [mode, setMode] = useState<FindMode>(() => readMode() ?? "scan");
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<PrasadamLookupResult | null>(null);
  const [marked, setMarked] = useState<{ result: AlreadyGiven; until: number } | null>(null);
  const [undoOpen, setUndoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const busyRef = useRef(false);
  const lookupSeq = useRef(0);
  const lastScan = useRef<{ text: string; at: number } | null>(null);
  /** The slip just dealt with (marked, Scan next, Not now): counted as seen again when the camera comes back. */
  const handledCode = useRef<string | null>(null);
  const tokenLooked = useRef(false);

  const today = businessDate(new Date());

  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  // Back online: the next request decides again whether the office answers.
  useEffect(() => {
    const reset = (): void => setConnectionLost(false);
    window.addEventListener("online", reset);
    return () => window.removeEventListener("online", reset);
  }, []);

  // Undo closes UNDO_MS after this person's own give (opened when the give answered).
  useEffect(() => {
    if (!marked) return undefined;
    const timer = setTimeout(() => setUndoOpen(false), Math.max(0, marked.until - Date.now()));
    return () => clearTimeout(timer);
  }, [marked]);

  const focusInput = useCallback((select = false) => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      if (select) inputRef.current?.select();
    });
  }, []);

  /** Runs one request at a time; a lost connection shows the check-by-eye message (C-28), other errors their text. */
  const run = useCallback(async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
    if (busyRef.current) return undefined;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const value = await work();
      setConnectionLost(false);
      return value;
    } catch (err) {
      if (isConnectionError(err)) setConnectionLost(true);
      else setError(err instanceof SevaClientError ? err.message : PRASADAM.failed.en);
      return undefined;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  /**
   * The slip just dealt with in scan mode is probably still in front of the camera: count it as seen now, so it is
   * ignored while it stays in view and looked up again (its card shown) once it was out of view for REPEAT_SCAN_MS.
   */
  const noteHandled = useCallback(() => {
    const code = mode === "scan" ? (lastScan.current?.text ?? null) : null;
    handledCode.current = code;
    if (code !== null) lastScan.current = { text: code, at: Date.now() };
  }, [mode]);

  /** The camera is reading again: the handled slip counts as seen from this moment (the camera can start slowly). */
  const onCameraRunning = useCallback(() => {
    const code = handledCode.current;
    handledCode.current = null;
    if (code !== null && lastScan.current?.text === code) lastScan.current = { text: code, at: Date.now() };
  }, []);

  const lookup = useCallback(
    async (query: string) => {
      const seq = ++lookupSeq.current;
      const answer = await run(() => api.lookup(query));
      if (!answer || seq !== lookupSeq.current) return;
      setResult(answer);
      // A finished "Marked given" note goes once the next slip is looked up; one still open for Undo stays.
      setMarked((current) => (current && current.until > Date.now() ? current : null));
    },
    [api, run],
  );

  const give = useCallback(
    async (receiptId: string, receiptNo: string, confirmOffDate: boolean) => {
      const answer = await run(() => api.give({ receiptId, confirmOffDate }));
      if (!answer) return;
      if (answer.state === "already_given" && answer.givenNow === true) {
        given.add(answer.receipt.id);
        setMarked({ result: answer, until: Date.now() + UNDO_MS });
        setUndoOpen(true);
        noteHandled();
        setResult(null);
        setTyped("");
        if (mode === "type") focusInput();
        return;
      }
      setResult(answer.state === "not_found" ? { state: "not_found", query: receiptNo } : answer);
    },
    [api, focusInput, given, mode, noteHandled, run],
  );

  const undo = useCallback(async () => {
    if (!marked) return;
    const { id, receiptNo } = marked.result.receipt;
    const done = await run(async () => {
      await api.undo({ receiptId: id });
      return true;
    });
    if (!done) return;
    given.remove(id);
    setMarked(null);
    setUndoOpen(false);
    await lookup(receiptNo);
  }, [api, given, lookup, marked, run]);

  // ?token= from the public receipt page: look it up at once (once per page load).
  useEffect(() => {
    if (tokenLooked.current || !user) return undefined;
    const token = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
    if (token === "") return undefined;
    const timer = setTimeout(() => {
      tokenLooked.current = true;
      void lookup(token);
    }, 0);
    return () => clearTimeout(timer);
  }, [lookup, user]);

  function changeMode(next: FindMode): void {
    setMode(next);
    saveMode(next);
    handledCode.current = null;
    setResult(null);
    if (next === "type") focusInput();
  }

  function clearForNext(): void {
    noteHandled();
    setResult(null);
    setError(null);
    setTyped("");
    if (mode === "type") focusInput();
  }

  const onScan = useCallback(
    (text: string) => {
      // A frame read while a request runs is dropped and is not counted as a sighting.
      if (busyRef.current) return;
      const now = Date.now();
      const previous = lastScan.current;
      lastScan.current = { text, at: now };
      // Still in front of the camera (seen again within REPEAT_SCAN_MS), including the slip just dealt with.
      if (previous && previous.text === text && now - previous.at < REPEAT_SCAN_MS) return;
      void lookup(text);
    },
    [lookup],
  );

  const showCamera = mode === "scan" && result === null;
  const offline = !online || connectionLost;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-4 md:py-6">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Bilingual as="h1" en={PRASADAM.title.en} kn={PRASADAM.title.kn} className="text-(length:--text-h2) leading-tight font-bold" />
          {me ? (
            <p className="text-(length:--text-meta) text-(--muted-foreground)">
              {me.name} · <span className="tabular-nums">{String(me.staffNo).padStart(3, "0")}</span> · {formatSevaDate(today)}
            </p>
          ) : null}
        </div>
        <GivenToday count={given.count} />
      </header>

      {offline ? (
        <div role="alert" data-testid="prasadam-offline" className="rounded-(--radius-control) border border-[color-mix(in_oklab,var(--primary-press)_30%,transparent)] bg-(--attn-soft) px-4 py-3 font-semibold">
          <Bilingual as="div" en={PRASADAM.offline.en} kn={PRASADAM.offline.kn} />
        </div>
      ) : null}

      {marked ? (
        <ResultCard
          result={marked.result}
          today={today}
          busy={busy}
          undoOpen={undoOpen}
          onUndo={() => void undo()}
          onMarkGiven={() => undefined}
          onGiveAnyway={() => undefined}
          onNotNow={() => undefined}
          onScanNext={() => undefined}
          onChoose={() => undefined}
          onTypeAgain={() => undefined}
          onScanInstead={() => undefined}
        />
      ) : null}

      <ScanTypeSwitch value={mode} onChange={changeMode} />

      {mode === "type" ? (
        <NumberEntry
          value={typed}
          busy={busy}
          inputRef={inputRef}
          onChange={setTyped}
          onSubmit={(text) => {
            setResult(null);
            void lookup(text);
          }}
        />
      ) : null}

      {showCamera ? <CameraScanner readyForNext={marked !== null} onCode={onScan} onRunning={onCameraRunning} /> : null}

      {error ? (
        <p role="alert" className="rounded-(--radius-control) border border-(--destructive) bg-(--destructive-soft) px-4 py-3 font-semibold text-(--destructive)">
          {error}
        </p>
      ) : null}

      <div aria-live="polite">
        {result ? (
          <ResultCard
            key={resultKey(result)}
            result={result}
            today={today}
            busy={busy}
            onMarkGiven={() => {
              if (result.state === "ready") void give(result.receipt.id, result.receipt.receiptNo, false);
            }}
            onGiveAnyway={() => {
              if (result.state === "another_day") void give(result.receipt.id, result.receipt.receiptNo, true);
            }}
            onNotNow={clearForNext}
            onScanNext={clearForNext}
            onUndo={() => undefined}
            onChoose={(receiptNo) => void lookup(receiptNo)}
            onTypeAgain={() => {
              setResult(null);
              if (mode !== "type") {
                setMode("type");
                saveMode("type");
              }
              focusInput(true);
            }}
            onScanInstead={() => changeMode("scan")}
          />
        ) : null}
      </div>
    </div>
  );
}
