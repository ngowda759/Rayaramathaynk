"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";

import type { DevoteeSuggestion } from "@/components/seva/counter/DevoteeStep";
import { useAuth } from "@/hooks/useAuth";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { buildCounterOrderPayload, profileToDraft } from "@/lib/seva/counter/payload";
import {
  counterReducer,
  indexCatalogue,
  initialCounterState,
  selectCanSave,
  selectGroups,
  type CatalogueIndex,
  type CounterAction,
  type CounterState,
  type DevoteeDraft,
  type SaveBlock,
} from "@/lib/seva/counter/state";
import { createExcelCopyScheduler, issuedToExportRow, type ExcelCopyScheduler } from "@/lib/seva/excel/copyScheduler";
import { buildDayWorkbookBytes, downloadDayExcel } from "@/lib/seva/excel/download";
import { allowExcelFolder, chooseExcelFolder, EXCEL_FOLDER_KEY, excelFolderStatus, type FolderStatus } from "@/lib/seva/excel/folder";
import type { CounterLine, GroupResult } from "@/lib/seva/grouping";
import { formatReceiptNo, parseReceiptNo } from "@/lib/seva/numbering";
import { raiseOfflineFloor, raiseOfflineGroupFloor } from "@/lib/seva/offline/allocator";
import { connectionStore, errorCode, isUnreachable, type ConnectionState } from "@/lib/seva/offline/connection";
import { openSevaDb, type SevaDb } from "@/lib/seva/offline/db";
import { deviceHeader, getDeviceCredentials } from "@/lib/seva/offline/device";
import { startHeartbeat } from "@/lib/seva/offline/heartbeat";
import { todaysReceipts } from "@/lib/seva/offline/local-receipts";
import { refreshWaiting } from "@/lib/seva/offline/outbox";
import { cacheProfile, findProfiles } from "@/lib/seva/offline/profiles";
import { createCounterSubmitter, OfflineIssueError } from "@/lib/seva/offline/submitter";
import { runSync } from "@/lib/seva/offline/sync";
import { printSlips } from "@/lib/seva/print/printSlips";
import { toSlipModel } from "@/lib/seva/print/slip-model";
import { newQrToken } from "@/lib/seva/qr";
import { COUNTER_TEXT, OFFLINE_ISSUE_TEXT } from "@/lib/seva/strings/counter";
import { addDays, businessDate, istParts } from "@/lib/seva/time";
import { counterApi } from "@/services/seva/counter.service";
import { SevaClientError } from "@/services/seva/http";
import { receiptsApi } from "@/services/seva/receipts.service";
import type { CatalogueSeva, CounterBootstrap, CounterOrderPayload, IssuedReceipt } from "@/types/seva";

/**
 * The counter screen's state and effects (Design Book 9, 8.3, 8.6, 9.11). The order itself lives in the pure reducer
 * (lib/seva/counter/state.ts); this hook adds the network, this PC's IndexedDB, printing, the outbox, the heartbeat,
 * the Excel copy and the returning-devotee search.
 *
 * Save: build the order (client ids and QR tokens are kept while the same order is retried, so a retry after an
 * unanswered save can never issue it twice) -> the submitter saves it online or with OF numbers -> print one slip per
 * receipt -> record the first print -> cache the devotee profile -> note the receipts for the Excel copy -> clear the
 * form and put the cursor back in Name. A business refusal keeps the order; a catalogue change reloads the catalogue.
 */

export type CounterPhase = "loading" | "no_device" | "ready" | "error";

export interface CounterMessage {
  tone: "error" | "info";
  text: string;
}

export interface CounterExcel {
  status: FolderStatus | "written";
  /** The chosen folder's name, when one is chosen. */
  folderName: string | null;
  /** The last write failed for another reason (for example the file is open in Excel); it is retried by itself. */
  failed: boolean;
  choose(): Promise<void>;
  allow(): Promise<void>;
  saveNow(): Promise<void>;
  download(): Promise<void>;
}

export interface UseCounter {
  state: CounterState;
  dispatch(a: CounterAction): void;
  groups: GroupResult;
  canSave: { ok: true } | { ok: false; block: SaveBlock };
  save(): Promise<void>;
  connection: ConnectionState;
  nextNumberPreview: string;
  bootstrap: CounterBootstrap | null;
  excel: CounterExcel;
  // Beyond the plan's minimum: what the screen needs to show the rest of Design Book 9.
  phase: CounterPhase;
  loadError: string | null;
  reload(): Promise<void>;
  catalogue: CatalogueIndex;
  message: CounterMessage | null;
  dismissMessage(): void;
  lastPrinted: { receipts: IssuedReceipt[]; offline: boolean } | null;
  inDoubt: boolean;
  answerInDoubt(printOffline: boolean): void;
  dayClosed: boolean;
  skewMs: number;
  today: { receipts: number; cashPaise: number; upiPaise: number };
  setForcedOffline(on: boolean): void;
  suggestion: DevoteeSuggestion | null;
  acceptSuggestion(): void;
  rejectSuggestion(): void;
  filledFrom: { lastVisit: string } | null;
  undoSuggestion(): void;
  /** Bumped after every good save, so the screen puts the cursor back in Name. */
  focusTick: number;
  staffLabel: string;
}

/** Office answers that mean the catalogue changed under the order: reload it and keep the order (Review Focus 1). */
const CATALOGUE_CODES = new Set(["price_changed", "seva_inactive", "seva_not_on_counter", "amount_change_not_allowed"]);
const DEVICE_CODES = new Set(["device_required", "device_unknown"]);
const SYNC_INTERVAL_MS = 30_000;
const SUGGEST_DEBOUNCE_MS = 250;
const SUGGEST_MIN_LETTERS = 3;
const PHONE_E164 = /^\+91[6-9][0-9]{9}$/;

type HookAction = CounterAction | { type: "reprice"; catalogue: CatalogueSeva[] };

function newId(): string {
  return globalThis.crypto.randomUUID();
}

/** A full Indian mobile number as +91XXXXXXXXXX, else null (same rule as the shared devotee schema). */
function phoneE164(raw: string): string | null {
  const match = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(raw.replace(/[\s\-().]/g, ""));
  return match ? `+91${match[1]}` : null;
}

function withoutReason(line: CounterLine): CounterLine {
  const copy = { ...line };
  delete copy.changeReason;
  return copy;
}

/**
 * After the office reloads the catalogue: lines take the new catalogue price; a line whose amount was changed keeps
 * the changed price (and stops being a change if it now equals the catalogue). Lines of sevas no longer offered stay
 * as typed, so the receptionist sees what to remove.
 */
function repriceLines(s: CounterState, catalogue: CatalogueSeva[]): CounterState {
  if (s.submitting) return s;
  const byId = new Map(catalogue.map((c) => [c.id, c]));
  let changed = false;
  const lines = s.lines.map((line) => {
    const seva = byId.get(line.sevaId);
    if (!seva || seva.ratePaise === line.catalogueRatePaise) return line;
    changed = true;
    const rate = seva.ratePaise;
    if (rate === null) return { ...withoutReason(line), catalogueRatePaise: null };
    const wasChanged = line.catalogueRatePaise !== null && line.unitRatePaise !== line.catalogueRatePaise;
    if (!wasChanged) return { ...withoutReason(line), catalogueRatePaise: rate, unitRatePaise: rate };
    if (line.unitRatePaise === rate) return { ...withoutReason(line), catalogueRatePaise: rate };
    return { ...line, catalogueRatePaise: rate };
  });
  return changed ? { ...s, lines, confirmLargeCash: false } : s;
}

function hookReducer(cat: CatalogueIndex, daysAhead: number): (s: CounterState, a: HookAction) => CounterState {
  const base = counterReducer(cat, daysAhead);
  return (s, a) => (a.type === "reprice" ? repriceLines(s, a.catalogue) : base(s, a));
}

/** Sevas of the previous catalogue missing from the new one stay known for display only, switched off. */
function displayCatalogue(current: CatalogueSeva[], previous: CatalogueSeva[]): CatalogueSeva[] {
  const ids = new Set(current.map((s) => s.id));
  return [...current, ...previous.filter((s) => !ids.has(s.id)).map((s) => ({ ...s, active: false }))];
}

function messageOf(err: unknown): string {
  if (err instanceof OfflineIssueError) return OFFLINE_ISSUE_TEXT[err.code] ?? COUNTER_TEXT.loadFailed.en;
  if (err instanceof SevaClientError) return err.message;
  return COUNTER_TEXT.loadFailed.en;
}

/** A cached catalogue from an earlier day still serves offline, but today starts empty and open. */
function forToday(b: CounterBootstrap, now: Date): CounterBootstrap {
  const today = businessDate(now);
  if (b.today.businessDate === today) return b;
  return { ...b, today: { businessDate: today, receipts: 0, cashPaise: 0, upiPaise: 0, dayClosed: false } };
}

async function raiseFloors(db: SevaDb, b: CounterBootstrap): Promise<void> {
  const server = istParts(new Date(b.serverTime));
  const yymm = `${String(server.year % 100).padStart(2, "0")}${String(server.month).padStart(2, "0")}`;
  await raiseOfflineFloor(db, { series: b.counter.offlineSeries, year: server.year, serverLastNo: b.lastOfNo });
  await raiseOfflineGroupFloor(db, { series: b.counter.offlineSeries, yymm, serverLastNo: b.lastOfGroupNo });
}

export function useCounter(): UseCounter {
  const { user } = useAuth();
  const { me } = useSevaMe();

  const userRef = useRef(user);
  const meRef = useRef(me);
  const dbRef = useRef<SevaDb | null>(null);
  const deviceRef = useRef<string | null>(null);
  const bootstrapRef = useRef<CounterBootstrap | null>(null);
  const submitterRef = useRef<ReturnType<typeof createCounterSubmitter> | null>(null);
  const excelRef = useRef<ExcelCopyScheduler | null>(null);
  const inDoubtResolve = useRef<((yes: boolean) => void) | null>(null);
  const savingRef = useRef(false);
  const pendingIdsRef = useRef<{ key: string; ids: { clientOrderId: string; clientReceiptIds: string[]; qrTokens: string[] } } | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());
  const dayClosedRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
    meRef.current = me;
  }, [user, me]);

  const [phase, setPhase] = useState<CounterPhase>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<CounterBootstrap | null>(null);
  const [shownCatalogue, setShownCatalogue] = useState<CatalogueSeva[]>([]);
  const [message, setMessage] = useState<CounterMessage | null>(null);
  const [lastPrinted, setLastPrinted] = useState<UseCounter["lastPrinted"]>(null);
  const [inDoubt, setInDoubt] = useState(false);
  const [dayClosed, setDayClosedState] = useState(false);
  const [skewMs, setSkewMs] = useState(0);
  const [today, setToday] = useState({ receipts: 0, cashPaise: 0, upiPaise: 0 });
  const [onlineNext, setOnlineNext] = useState(1);
  const [ofNext, setOfNext] = useState(1);
  const [focusTick, setFocusTick] = useState(0);
  const [suggestion, setSuggestion] = useState<DevoteeSuggestion | null>(null);
  const [filled, setFilled] = useState<{ lastVisit: string; previous: DevoteeDraft } | null>(null);
  const [excelStatus, setExcelStatus] = useState<FolderStatus | "written">("not_set");
  const [excelFolder, setExcelFolder] = useState<string | null>(null);
  const [excelFailed, setExcelFailed] = useState(false);

  const connection = useSyncExternalStore(connectionStore.subscribe, connectionStore.get, connectionStore.get);

  const catalogue = useMemo(() => indexCatalogue(shownCatalogue), [shownCatalogue]);
  const daysAhead = bootstrap?.rules.counterDaysAhead ?? 365;
  const reducer = useMemo(() => hookReducer(catalogue, daysAhead), [catalogue, daysAhead]);
  const [state, dispatchRaw] = useReducer(reducer, undefined, () => initialCounterState(businessDate(new Date())));
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setDayClosed = useCallback((closed: boolean) => {
    dayClosedRef.current = closed;
    setDayClosedState(closed);
  }, []);

  /* ---------- office clients ---------- */

  const token = useCallback(async (): Promise<string> => {
    const current = userRef.current;
    if (!current) throw new SevaClientError("unauthenticated", 401, "Sign in again to use the counter.");
    return current.getIdToken();
  }, []);
  const device = useCallback((): string | null => deviceRef.current, []);
  const apiRef = useRef<ReturnType<typeof counterApi> | null>(null);
  const lookupsRef = useRef<ReturnType<typeof receiptsApi> | null>(null);
  /** The office clients, made on first use outside render; each call reads the ID token and device header then. */
  const getApi = useCallback(() => (apiRef.current ??= counterApi(token, device)), [token, device]);
  const getLookups = useCallback(() => (lookupsRef.current ??= receiptsApi(token, device)), [token, device]);

  /* ---------- catalogue (bootstrap) ---------- */

  const refreshOfNext = useCallback(async (): Promise<void> => {
    const db = dbRef.current;
    const b = bootstrapRef.current;
    if (!db || !b) return;
    // lib/seva/offline/allocator.ts keeps the last OF number used under `of:<series>:<year>` in `meta`.
    const last = await db.get("meta", `of:${b.counter.offlineSeries}:${istParts(new Date()).year}`);
    setOfNext(Math.max(typeof last === "number" ? last : 0, b.lastOfNo) + 1);
  }, []);

  const applyBootstrap = useCallback(
    (b: CounterBootstrap) => {
      const previous = bootstrapRef.current?.catalogue ?? [];
      bootstrapRef.current = b;
      setBootstrap(b);
      setShownCatalogue(displayCatalogue(b.catalogue, previous));
      setDayClosed(b.today.dayClosed);
      setToday({ receipts: b.today.receipts, cashPaise: b.today.cashPaise, upiPaise: b.today.upiPaise });
      setOnlineNext(b.nextNumbers.find((n) => n.series === b.counter.onlineSeries)?.nextRunningNo ?? 1);
      const s = stateRef.current;
      if (s.today !== b.today.businessDate && s.lines.length === 0 && !s.submitting) {
        dispatchRaw({ type: "reset", today: b.today.businessDate });
      }
      void refreshOfNext().catch(() => undefined);
    },
    [refreshOfNext, setDayClosed],
  );

  const loadBootstrap = useCallback(async (): Promise<boolean> => {
    const db = dbRef.current;
    if (!db) return false;
    try {
      let b: CounterBootstrap;
      const cached = async (): Promise<CounterBootstrap | undefined> => db.get("catalogue", "current");
      if (connectionStore.get().forced) {
        const saved = await cached();
        if (!saved) throw new SevaClientError("network", 0, COUNTER_TEXT.loadFailed.en);
        b = forToday(saved, new Date());
      } else {
        try {
          b = await getApi().bootstrap();
          connectionStore.markOnline();
          await db.put("catalogue", b, "current");
          await raiseFloors(db, b).catch(() => undefined);
        } catch (err) {
          if (!isUnreachable(err)) throw err;
          const saved = await cached();
          if (!saved) throw err;
          connectionStore.markOffline(new Date());
          b = forToday(saved, new Date());
        }
      }
      applyBootstrap(b);
      setLoadError(null);
      setPhase("ready");
      return true;
    } catch (err) {
      const code = errorCode(err);
      if (code && DEVICE_CODES.has(code)) {
        setPhase("no_device");
        return false;
      }
      setLoadError(messageOf(err));
      setPhase((p) => (p === "ready" ? p : "error"));
      return false;
    }
  }, [getApi, applyBootstrap]);

  /* ---------- open this PC's database, check the device, load the catalogue ---------- */

  const askPrintOffline = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        inDoubtResolve.current = resolve;
        setInDoubt(true);
      }),
    [],
  );

  const answerInDoubt = useCallback((printOffline: boolean) => {
    setInDoubt(false);
    const resolve = inDoubtResolve.current;
    inDoubtResolve.current = null;
    resolve?.(printOffline);
  }, []);

  const start = useCallback(async (isCancelled: () => boolean): Promise<void> => {
    let db: SevaDb;
    try {
      db = await openSevaDb();
    } catch {
      setLoadError(COUNTER_TEXT.noStorage);
      setPhase("error");
      return;
    }
    if (isCancelled()) {
      db.close();
      return;
    }
    dbRef.current = db;
    const credentials = await getDeviceCredentials(db).catch(() => null);
    if (isCancelled()) return;
    if (!credentials) {
      setPhase("no_device");
      return;
    }
    deviceRef.current = deviceHeader(credentials);
    submitterRef.current = createCounterSubmitter({
      db,
      api: getApi(),
      clock: () => new Date(),
      askPrintOffline,
      staff: () => ({ name: meRef.current?.name ?? "", staffNo: meRef.current?.staffNo ?? 0 }),
      counter: () => {
        const b = bootstrapRef.current;
        if (!b) throw new Error("counter_not_loaded");
        return { name: b.counter.name, offlineSeries: b.counter.offlineSeries };
      },
      catalogue: () => {
        const b = bootstrapRef.current;
        if (!b) throw new Error("counter_not_loaded");
        return b;
      },
      // The browser itself knows it has no connection: no office call can have reached the office, so the order goes
      // straight to OF numbers without the in-doubt question (Design Book 9.11).
      isForcedOffline: () => connectionStore.get().forced || (typeof navigator !== "undefined" && navigator.onLine === false),
      newIds: () => ({ clientOrderId: newId() }),
    });
    await refreshWaiting(db).catch(() => undefined);
    if (isCancelled()) return;
    await loadBootstrap();
  }, [getApi, askPrintOffline, loadBootstrap]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start() sets state only after IndexedDB opens (async).
    void start(() => cancelled);
    return () => {
      cancelled = true;
      submitterRef.current = null;
      dbRef.current?.close();
      dbRef.current = null;
    };
  }, [start]);

  const reload = useCallback(async (): Promise<void> => {
    if (!dbRef.current) {
      setPhase("loading");
      await start(() => false);
      return;
    }
    await loadBootstrap();
  }, [loadBootstrap, start]);

  /* ---------- heartbeat, outbox sending, connection events ---------- */

  const ready = phase === "ready";

  useEffect(() => {
    const db = dbRef.current;
    if (!ready || connection.forced || !db) return;
    return startHeartbeat({
      api: getApi(),
      db,
      clock: () => new Date(),
      onResult: ({ skewMs: skew, dayClosed: closed }) => {
        setSkewMs(skew);
        setDayClosed(closed);
        void refreshOfNext().catch(() => undefined);
      },
    });
  }, [ready, connection.forced, getApi, refreshOfNext, setDayClosed]);

  useEffect(() => {
    const db = dbRef.current;
    if (!ready || connection.forced || !db) return;
    const send = (): void => {
      void runSync({ db, api: getApi() })
        .then((summary) => {
          if (summary.sent > 0) excelRef.current?.noteReceipts(0);
          if (summary.refused.length > 0) setMessage({ tone: "error", text: COUNTER_TEXT.refused(summary.refused.length) });
        })
        .catch(() => undefined);
    };
    send();
    const timer = setInterval(send, SYNC_INTERVAL_MS);
    window.addEventListener("online", send);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", send);
    };
  }, [ready, connection.forced, getApi]);

  useEffect(() => {
    const goneOffline = (): void => connectionStore.markOffline(new Date());
    window.addEventListener("offline", goneOffline);
    return () => window.removeEventListener("offline", goneOffline);
  }, []);

  const setForcedOffline = useCallback((on: boolean) => {
    connectionStore.setForcedOffline(on);
  }, []);

  /* ---------- Excel copy ---------- */

  const counterName = bootstrap?.counter.name ?? null;

  useEffect(() => {
    const db = dbRef.current;
    if (!ready || !db || counterName === null) return;
    const scheduler = createExcelCopyScheduler({
      db,
      getRows: async (date) => (await todaysReceipts(db, date)).map(issuedToExportRow),
      build: (rows, date) => buildDayWorkbookBytes(rows, { date, counterName }),
      clock: () => new Date(),
      onStatus: (s) => {
        setExcelStatus(s);
        setExcelFailed(false);
      },
      onError: () => setExcelFailed(true),
    });
    excelRef.current = scheduler;
    void (async () => {
      try {
        setExcelStatus(await excelFolderStatus(db));
        setExcelFolder((await db.get("files", EXCEL_FOLDER_KEY))?.name ?? null);
      } catch {
        // The status line simply stays "not set".
      }
    })();
    return () => {
      scheduler.stop();
      if (excelRef.current === scheduler) excelRef.current = null;
    };
  }, [ready, counterName]);

  const excel: CounterExcel = useMemo(
    () => ({
      status: excelStatus,
      folderName: excelFolder,
      failed: excelFailed,
      async choose() {
        const db = dbRef.current;
        if (!db) return;
        try {
          const chosen = await chooseExcelFolder(db);
          if (!chosen) return;
          setExcelFolder(chosen.name);
          setExcelStatus(await excelFolderStatus(db));
          await excelRef.current?.flushNow();
        } catch {
          setExcelFailed(true);
        }
      },
      async allow() {
        const db = dbRef.current;
        if (!db) return;
        try {
          await allowExcelFolder(db);
          setExcelStatus(await excelFolderStatus(db));
          await excelRef.current?.flushNow();
        } catch {
          setExcelFailed(true);
        }
      },
      async saveNow() {
        await excelRef.current?.flushNow();
      },
      async download() {
        const db = dbRef.current;
        if (!db || counterName === null) return;
        const date = businessDate(new Date());
        try {
          const rows = (await todaysReceipts(db, date)).map(issuedToExportRow);
          await downloadDayExcel(rows, { date, counterName });
        } catch {
          setExcelFailed(true);
        }
      },
    }),
    [excelStatus, excelFolder, excelFailed, counterName],
  );

  /* ---------- returning devotee ---------- */

  const devoteeName = state.devotee.name;
  const devoteePhone = state.devotee.phone;
  const online = connection.status === "online" && !connection.forced;

  useEffect(() => {
    const db = dbRef.current;
    const name = devoteeName.trim();
    const phone = phoneE164(devoteePhone);
    const wanted = ready && filled === null && (Array.from(name).length >= SUGGEST_MIN_LETTERS || phone !== null);
    let stale = false;
    const timer = setTimeout(
      () => {
        if (!wanted || !db) {
          setSuggestion(null);
          return;
        }
        void (async () => {
          const query = { name: Array.from(name).length >= SUGGEST_MIN_LETTERS ? name : undefined, phone: phone ?? undefined };
          let found: DevoteeSuggestion[] = [];
          try {
            if (!online) throw new SevaClientError("network", 0, "offline");
            found = (await getLookups().searchDevotees(query)).map((m) => ({ ...m }));
          } catch (err) {
            if (!isUnreachable(err)) found = [];
            else {
              const local = await findProfiles(db, { name: query.name, phoneE164: query.phone }).catch(() => []);
              found = local.map((p) => ({
                name: p.name,
                gotra: p.gotra ?? null,
                gotraId: p.gotraId ?? null,
                nakshatraId: p.nakshatraId ?? null,
                rashiId: p.rashiId ?? null,
                phoneLast4: p.phoneLast4,
                lastVisit: p.lastSeen,
              }));
            }
          }
          if (stale) return;
          const first = found.find((m) => !dismissedRef.current.has(`${m.name}|${m.phoneLast4 ?? ""}|${m.lastVisit}`));
          setSuggestion(first ?? null);
        })();
      },
      wanted ? SUGGEST_DEBOUNCE_MS : 0,
    );
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [devoteeName, devoteePhone, ready, filled, online, getLookups]);

  const acceptSuggestion = useCallback(() => {
    const s = suggestion;
    if (!s) return;
    const previous = stateRef.current.devotee;
    dispatchRaw({
      type: "applyProfile",
      devotee: profileToDraft({
        name: s.name,
        gotra: s.gotra ?? undefined,
        gotraId: s.gotraId ?? undefined,
        nakshatraId: s.nakshatraId ?? undefined,
        rashiId: s.rashiId ?? undefined,
        phoneLast4: s.phoneLast4 ?? undefined,
      }),
    });
    setFilled({ lastVisit: s.lastVisit, previous });
    setSuggestion(null);
  }, [suggestion]);

  const rejectSuggestion = useCallback(() => {
    if (suggestion) dismissedRef.current.add(`${suggestion.name}|${suggestion.phoneLast4 ?? ""}|${suggestion.lastVisit}`);
    setSuggestion(null);
  }, [suggestion]);

  const undoSuggestion = useCallback(() => {
    if (!filled) return;
    dispatchRaw({ type: "setDevotee", patch: { ...filled.previous } });
    setFilled(null);
  }, [filled]);

  /* ---------- save and print ---------- */

  const afterIssue = useCallback(
    async (receipts: IssuedReceipt[], offline: boolean, payload: CounterOrderPayload): Promise<void> => {
      const b = bootstrapRef.current;
      const db = dbRef.current;
      if (!b) return;
      setLastPrinted({ receipts, offline });
      try {
        await printSlips(receipts.map((r) => toSlipModel(r, b.slip, { siteUrl: b.siteUrl })));
        if (!offline) {
          const ids = receipts.map((r) => r.id).filter((id): id is string => id !== null);
          if (ids.length > 0) void getApi().prints(ids).catch(() => undefined);
        }
      } catch {
        setMessage({ tone: "error", text: COUNTER_TEXT.printFailed });
      }

      const totalPaise = receipts.reduce((sum, r) => sum + r.totalPaise, 0);
      const mode = payload.payment.mode;
      setToday((t) => ({
        receipts: t.receipts + receipts.length,
        cashPaise: t.cashPaise + (mode === "cash" ? totalPaise : 0),
        upiPaise: t.upiPaise + (mode === "upi" ? totalPaise : 0),
      }));
      if (offline) {
        void refreshOfNext().catch(() => undefined);
      } else {
        const highest = receipts
          .map((r) => parseReceiptNo(r.receiptNo))
          .filter((p) => p !== null && p.series === b.counter.onlineSeries)
          .reduce((max, p) => Math.max(max, p?.running ?? 0), 0);
        if (highest > 0) setOnlineNext(highest + 1);
      }

      const phone = payload.devotee.phone;
      if (db && phone && PHONE_E164.test(phone)) {
        void cacheProfile(db, {
          name: payload.devotee.name,
          gotra: payload.devotee.gotra?.text,
          gotraId: payload.devotee.gotra?.id,
          nakshatraId: payload.devotee.nakshatra?.id,
          rashiId: payload.devotee.rashi?.id,
          lastSeen: businessDate(new Date()),
          phoneE164: phone,
        }).catch(() => undefined);
      }
      excelRef.current?.noteReceipts(receipts.length);
    },
    [getApi, refreshOfNext],
  );

  const handleSaveError = useCallback(
    async (err: unknown): Promise<void> => {
      const code = errorCode(err);
      const text = messageOf(err);
      if (code && CATALOGUE_CODES.has(code)) {
        await loadBootstrap();
        const b = bootstrapRef.current;
        if (b) dispatchRaw({ type: "reprice", catalogue: b.catalogue });
        setMessage({ tone: "error", text: `${text} ${COUNTER_TEXT.catalogueReloaded}` });
        return;
      }
      if (code === "day_closed" || code === "day_already_closed") setDayClosed(true);
      if (code && DEVICE_CODES.has(code)) setPhase("no_device");
      setMessage({ tone: "error", text });
    },
    [loadBootstrap, setDayClosed],
  );

  const save = useCallback(async (): Promise<void> => {
    const s = stateRef.current;
    const submitter = submitterRef.current;
    if (savingRef.current || !submitter || !bootstrapRef.current || dayClosedRef.current) return;
    if (!selectCanSave(s).ok) return;
    const groups = selectGroups(s);
    if (!groups.ok) return;

    savingRef.current = true;
    setMessage(null);
    dispatchRaw({ type: "submitStarted" });
    try {
      const n = groups.receipts.length;
      // The same order keeps its client ids and QR tokens across retries; a changed order gets new ones.
      const key = JSON.stringify(
        buildCounterOrderPayload(s, { clientOrderId: "", clientReceiptIds: Array(n).fill(""), qrTokens: Array(n).fill("") }),
      );
      if (pendingIdsRef.current?.key !== key) {
        pendingIdsRef.current = {
          key,
          ids: {
            clientOrderId: newId(),
            clientReceiptIds: Array.from({ length: n }, () => newId()),
            qrTokens: Array.from({ length: n }, () => newQrToken()),
          },
        };
      }
      const payload = buildCounterOrderPayload(s, pendingIdsRef.current.ids);
      const result = await submitter.submit(payload);
      if (result.mode === "cancelled") {
        dispatchRaw({ type: "submitFinished", ok: false });
        setMessage({ tone: "info", text: COUNTER_TEXT.cancelledNothingSaved });
        return;
      }
      pendingIdsRef.current = null;
      await afterIssue(result.receipts, result.mode === "offline", payload);
      dispatchRaw({ type: "submitFinished", ok: true });
      setFilled(null);
      setSuggestion(null);
      dismissedRef.current.clear();
      setFocusTick((t) => t + 1);
    } catch (err) {
      dispatchRaw({ type: "submitFinished", ok: false });
      await handleSaveError(err);
    } finally {
      savingRef.current = false;
    }
  }, [afterIssue, handleSaveError]);

  /* ---------- what the screen reads ---------- */

  const groups = useMemo(() => selectGroups(state), [state]);
  const canSave = useMemo(() => selectCanSave(state), [state]);

  const nextNumberPreview = useMemo(() => {
    if (!bootstrap || !me) return "";
    const offline = connection.status === "offline";
    const now = istParts(new Date());
    return formatReceiptNo({
      series: offline ? bootstrap.counter.offlineSeries : bootstrap.counter.onlineSeries,
      staffNo: me.staffNo,
      channel: null,
      month: now.month,
      year: now.year,
      running: offline ? ofNext : onlineNext,
    });
  }, [bootstrap, me, connection.status, ofNext, onlineNext]);

  const dispatch = useCallback((a: CounterAction) => dispatchRaw(a), []);
  const dismissMessage = useCallback(() => setMessage(null), []);

  return {
    state,
    dispatch,
    groups,
    canSave,
    save,
    connection,
    nextNumberPreview,
    bootstrap,
    excel,
    phase,
    loadError,
    reload,
    catalogue,
    message,
    dismissMessage,
    lastPrinted,
    inDoubt,
    answerInDoubt,
    dayClosed,
    skewMs,
    today,
    setForcedOffline,
    suggestion,
    acceptSuggestion,
    rejectSuggestion,
    filledFrom: filled && state.devotee.name.trim() !== "" ? { lastVisit: filled.lastVisit } : null,
    undoSuggestion,
    focusTick,
    staffLabel: me ? `${me.name} - ${String(me.staffNo).padStart(3, "0")}` : "",
  };
}

/** The last day the counter may date a seva: today + counter_days_ahead (C-29). */
export function counterMaxDate(b: CounterBootstrap | null, today: string): string {
  return addDays(today, b?.rules.counterDaysAhead ?? 365);
}

export default useCounter;
