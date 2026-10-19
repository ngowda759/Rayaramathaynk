"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Chip } from "@/components/seva/ui/Chip";
import { Button } from "@/components/ui/button";
import { sevaControlClass } from "@/components/ui/input";
import { connectionStore, isUnreachable, type ConnectionState } from "@/lib/seva/offline/connection";
import { runTransaction, type SevaDb } from "@/lib/seva/offline/db";
import { rememberReceipts, todaysReceipts, updateLocalReceipts } from "@/lib/seva/offline/local-receipts";
import { enqueueCancel, pendingItems, refreshWaiting } from "@/lib/seva/offline/outbox";
import { runSync } from "@/lib/seva/offline/sync";
import type { PermissionContext } from "@/lib/seva/permissions";
import { printSlips } from "@/lib/seva/print/printSlips";
import { toSlipModel } from "@/lib/seva/print/slip-model";
import type { Bi } from "@/lib/seva/strings/common";
import { CANCEL_DONE, MONEY, REPRINT, SPOILED, TODAY, TODAY_ERRORS } from "@/lib/seva/strings/today";
import { businessDate, cancelDeadline, formatSevaDate } from "@/lib/seva/time";
import { counterApi } from "@/services/seva/counter.service";
import { SevaClientError } from "@/services/seva/http";
import { receiptsApi } from "@/services/seva/receipts.service";
import type { CounterBootstrap, IssuedReceipt, PaymentMode, SevaAction, SevaMe } from "@/types/seva";
import type { ReceiptListItem, RefundState } from "@/types/seva-receipts";

import { CancelDialog, istClock, moneyBackLine, rupees, shortDate, shortNo, type CancelCandidate, type CancelChoice } from "./CancelDialog";
import { ReprintButton } from "./ReprintButton";
import { SpoiledDialog } from "./SpoiledDialog";

/** The cancel window when neither the counter rules nor a listed receipt says otherwise (D23). */
const DEFAULT_CANCEL_WINDOW_MINUTES = 30;
/** How often the outbox is sent and the "Cancel until" notes are refreshed while the page is open. */
const TICK_MS = 30_000;

/** One receipt as Today's receipts shows it: the office's register row, completed from this PC's own copy. */
export interface TodayRow extends CancelCandidate {
  /** The office's id; null for an offline receipt the office does not have yet. */
  id: string | null;
  /** Known when this PC keeps a copy (every receipt issued here); offline cancels name receipts by it. */
  clientReceiptId: string | null;
  series: string;
  sevas: string;
  status: "issued" | "cancelled";
  printCount: number;
  position: number;
  count: number;
  issuedByStaffId: string | null;
  issuedByStaffNo: number | null;
  /** The office's refund state; null while only this PC knows the receipt. */
  refundState: RefundState | null;
  /** Its issue or its cancel is still in this PC's outbox. */
  waiting: boolean;
}

export interface RowContext {
  me: SevaMe;
  can(action: SevaAction, ctx?: PermissionContext): boolean;
  now: Date;
  windowMinutes: number;
  offline: boolean;
}

export interface RowActions {
  cancel: boolean;
  reprint: boolean;
  /** "Spoiled - cancel and reissue". */
  spoiled: boolean;
  note: Bi | null;
}

function isOwn(row: TodayRow, me: SevaMe): boolean {
  if (row.issuedByStaffId !== null) return row.issuedByStaffId === me.staffId;
  return row.issuedByStaffNo !== null && row.issuedByStaffNo === me.staffNo;
}

/** This PC's counter id when the receipt is of one of its series; undefined for any other counter (or no PC). */
function counterIdOf(row: TodayRow, me: SevaMe): number | undefined {
  const counter = me.counter;
  if (!counter) return undefined;
  return row.series === counter.onlineSeries || row.series === counter.offlineSeries ? counter.id : undefined;
}

/**
 * What a person may do with one receipt here (DB §3.3 rows 3-5, §9.8, §9.9). The server checks each again; this only
 * decides what to show.
 * - Cancel: their own receipt inside the window, or any receipt for a temple admin or super admin. Offline only the
 *   own-inside-the-window cancel can be queued (the office checks it against that person and time).
 * - Reprint: online, from a registered PC, with receipt.reprint in the receipt's context.
 * - Spoiled reissue: online, a receipt of this PC's counter (the new number comes from it; the server refuses others)
 *   and of today's IST business date (an earlier day's slip gets a DUPLICATE reprint instead).
 */
export function rowActions(row: TodayRow, ctx: RowContext): RowActions {
  if (row.status === "cancelled") return { cancel: false, reprint: false, spoiled: false, note: null };
  const { me, now, windowMinutes } = ctx;
  const deadline = cancelDeadline(row.issuedAt, windowMinutes);
  const inWindow = now.getTime() <= deadline.getTime();
  const own = isOwn(row, me);
  const canOwn = own && ctx.can("receipt.cancel_own", { receiptIssuedByStaffId: me.staffId, withinCancelWindow: inWindow });
  const canAny = ctx.can("receipt.cancel_any");

  let note: Bi | null = null;
  if (own && inWindow) note = TODAY.cancelUntil(istClock(deadline));
  else if (!canAny) note = inWindow ? TODAY.issuedBySomeoneElse : TODAY.pastWindow(windowMinutes);

  // Offline, or a receipt the office does not have yet: only a queued cancel of one's own receipt in the window.
  if (ctx.offline || row.id === null) {
    return { cancel: canOwn && row.clientReceiptId !== null, reprint: false, spoiled: false, note };
  }

  const receiptCounterId = counterIdOf(row, me);
  const reprint =
    me.counter !== null && ctx.can("receipt.reprint", { receiptCounterId, receiptBusinessDate: row.businessDate });
  const spoiled = receiptCounterId !== undefined && row.businessDate === businessDate(now) && (canOwn || canAny);
  return { cancel: canOwn || canAny, reprint, spoiled, note };
}

/** The money line under a cancelled receipt, from the office's refund state (a late offline cash cancel is 'due'). */
export function cancelledLine(row: Pick<TodayRow, "status" | "mode" | "refundState" | "waiting">): Bi | null {
  if (row.status !== "cancelled") return null;
  if (row.waiting) return TODAY.cancelWaiting;
  switch (row.refundState) {
    case "done":
      return row.mode === "cash" ? MONEY.cashGivenBack : null;
    case "due":
      return row.mode === "cash" ? MONEY.refundDueCash : MONEY.refundDueUpi;
    case "processing":
      return MONEY.refundProcessing;
    case "failed":
      return MONEY.refundFailed;
    default:
      return null;
  }
}

/**
 * What to tell the person after the office cancelled receipts: cash to hand back only for what the office marked
 * done from the drawer; anything it left due (UPI, an earlier day, a late offline cancel, a closed day) is the
 * office's refund.
 */
export function cancelResultLines(rows: { mode: PaymentMode; totalPaise: number; refundState: RefundState }[]): Bi[] {
  const lines: Bi[] = [];
  const fromDrawer = rows.filter((r) => r.refundState === "done" && r.mode === "cash");
  if (fromDrawer.length > 0) {
    lines.push(MONEY.giveBack(rupees(fromDrawer.reduce((sum, r) => sum + r.totalPaise, 0)), fromDrawer.length));
  }
  const due = rows.filter((r) => r.refundState === "due");
  if (due.some((r) => r.mode === "cash")) lines.push(MONEY.refundDueCash);
  if (due.some((r) => r.mode !== "cash")) lines.push(MONEY.refundDueUpi);
  return lines;
}

function sevasOf(r: IssuedReceipt): string {
  return r.lines.map((l) => (l.quantity > 1 ? `${l.nameEn} x${l.quantity}` : l.nameEn)).join(", ");
}

function fromLocal(r: IssuedReceipt, waitingCancels: ReadonlySet<string>): TodayRow {
  return {
    key: r.id ?? r.clientReceiptId,
    id: r.id,
    clientReceiptId: r.clientReceiptId,
    receiptNo: r.receiptNo,
    series: r.seriesCode,
    businessDate: businessDate(new Date(r.issuedAt)),
    issuedAt: r.issuedAt,
    sevaDate: r.sevaDate,
    devoteeName: r.devotee.name,
    sevas: sevasOf(r),
    totalPaise: r.totalPaise,
    mode: r.payment.mode,
    status: r.status,
    printCount: r.printCount,
    groupNo: r.groupNo,
    position: r.position,
    count: r.count,
    issuedByStaffId: null,
    issuedByStaffNo: r.issuedBy.staffNo,
    refundState: null,
    waiting: r.id === null || waitingCancels.has(r.clientReceiptId),
  };
}

function fromServer(item: ReceiptListItem, local: IssuedReceipt | undefined, waitingCancels: ReadonlySet<string>): TodayRow {
  const cancelWaiting = local !== undefined && waitingCancels.has(local.clientReceiptId) && item.status === "issued";
  return {
    key: item.id,
    id: item.id,
    clientReceiptId: local?.clientReceiptId ?? null,
    receiptNo: item.receiptNo,
    series: item.series,
    businessDate: item.businessDate,
    issuedAt: item.issuedAt,
    sevaDate: local?.sevaDate ?? null,
    devoteeName: item.devoteeName,
    sevas: item.sevas,
    totalPaise: item.totalPaise,
    mode: item.mode,
    status: cancelWaiting ? "cancelled" : item.status,
    printCount: item.printCount,
    groupNo: item.groupNo,
    position: item.position,
    count: item.count,
    issuedByStaffId: item.issuedByStaffId,
    issuedByStaffNo: local?.issuedBy.staffNo ?? null,
    refundState: item.refundState,
    waiting: cancelWaiting,
  };
}

/**
 * The office's list merged with this PC's copies, newest first. Copies the office does not list are added when they
 * have not reached it yet, or when the office list is complete or unreachable. With a registered PC only its own
 * counter's receipts are shown (DB §9.9).
 */
export function mergeRows(
  server: { rows: ReceiptListItem[]; nextCursor: string | null } | null,
  local: readonly IssuedReceipt[],
  waitingCancels: ReadonlySet<string>,
  counter: SevaMe["counter"],
): TodayRow[] {
  const localByNo = new Map(local.map((r) => [r.receiptNo, r]));
  const listed = new Set<string>();
  const rows: TodayRow[] = [];
  for (const item of server?.rows ?? []) {
    if (counter && item.series !== counter.onlineSeries && item.series !== counter.offlineSeries) continue;
    listed.add(item.receiptNo);
    rows.push(fromServer(item, localByNo.get(item.receiptNo), waitingCancels));
  }
  const listComplete = server === null || server.nextCursor === null;
  for (const r of local) {
    if (listed.has(r.receiptNo)) continue;
    if (r.id === null || listComplete) rows.push(fromLocal(r, waitingCancels));
  }
  return rows.sort(
    (a, b) =>
      Date.parse(b.issuedAt) - Date.parse(a.issuedAt) ||
      (a.groupNo < b.groupNo ? -1 : a.groupNo > b.groupNo ? 1 : 0) ||
      a.position - b.position,
  );
}

/** Receipts of one payment shown together, in position order; a single receipt is a card of one. */
function toCards(rows: TodayRow[]): TodayRow[][] {
  const cards = new Map<string, TodayRow[]>();
  for (const row of rows) {
    const key = row.count > 1 ? `group:${row.groupNo}` : `one:${row.key}`;
    const card = cards.get(key);
    if (card) card.push(row);
    else cards.set(key, [row]);
  }
  return [...cards.values()].map((card) => card.sort((a, b) => a.position - b.position));
}

function matches(card: TodayRow[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return card.some(
    (r) => r.receiptNo.toLowerCase().includes(q) || r.devoteeName.toLowerCase().includes(q) || r.sevas.toLowerCase().includes(q),
  );
}

function modeLabel(mode: PaymentMode): string {
  if (mode === "cash") return "Cash";
  if (mode === "upi") return "UPI";
  return "Paid online";
}

/** The window the office lists with (issued_at + window = cancelDeadline). */
function windowFromRows(rows: readonly ReceiptListItem[] | undefined): number | null {
  const row = rows?.find((r) => r.cancelDeadline !== null);
  if (!row || row.cancelDeadline === null) return null;
  const minutes = Math.round((Date.parse(row.cancelDeadline) - Date.parse(row.issuedAt)) / 60_000);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

function messageOf(err: unknown): string {
  if (err instanceof SevaClientError) return err.status === 0 ? TODAY_ERRORS.unreachable.en : err.message;
  return TODAY_ERRORS.generic.en;
}

const realNow = (): Date => new Date();
const subscribeConnection = (fn: () => void): (() => void) => connectionStore.subscribe(fn);
const readConnection = (): ConnectionState => connectionStore.get();

interface Notice {
  tone: "ok" | "error";
  lines: Bi[];
}

export interface TodayListProps {
  me: SevaMe;
  can(action: SevaAction, ctx?: PermissionContext): boolean;
  /** The signed-in person's ID token for every office call. */
  token(): Promise<string>;
  /** This PC's `x-seva-device` value; sent with every call (a receptionist's list, cancel and prints need it). */
  deviceHeader: string | null;
  /** This PC's IndexedDB (local copies and the outbox); null where it cannot be opened. */
  db: SevaDb | null;
  now?: () => Date;
}

/**
 * Today's receipts at the counter (DB §9.8-9.9; mockup counter.html#recent): newest first, a group's receipts
 * together with each date's number, search by number, name or seva, cancel (all of a group or one date), reprint as a
 * DUPLICATE and the spoiled-print reissue. Offline it shows this PC's copies and queues an own-receipt cancel in the
 * outbox, which is sent on reconnect.
 */
export function TodayList({ me, can, token, deviceHeader, db, now = realNow }: TodayListProps): JSX.Element {
  const ids = useId();
  const apis = useMemo(
    () => ({ receipts: receiptsApi(token, () => deviceHeader), counter: counterApi(token, () => deviceHeader) }),
    [token, deviceHeader],
  );
  const connection = useSyncExternalStore(subscribeConnection, readConnection, readConnection);
  const offline = connection.status === "offline";

  const [server, setServer] = useState<{ rows: ReceiptListItem[]; nextCursor: string | null } | null>(null);
  const [local, setLocal] = useState<{ receipts: IssuedReceipt[]; waiting: ReadonlySet<string> }>({
    receipts: [],
    waiting: new Set<string>(),
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [clock, setClock] = useState<Date>(() => now());
  const [bootWindow, setBootWindow] = useState<number | null>(null);
  const bootstrapRef = useRef<CounterBootstrap | null>(null);

  const [cancelFor, setCancelFor] = useState<TodayRow[] | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [spoiledFor, setSpoiledFor] = useState<TodayRow | null>(null);
  const [spoiledBusy, setSpoiledBusy] = useState(false);
  const [spoiledError, setSpoiledError] = useState<string | null>(null);

  const today = businessDate(clock);
  const windowMinutes = bootWindow ?? windowFromRows(server?.rows) ?? DEFAULT_CANCEL_WINDOW_MINUTES;

  const readLocal = useCallback(async (): Promise<{ receipts: IssuedReceipt[]; waiting: ReadonlySet<string> }> => {
    if (!db) return { receipts: [], waiting: new Set<string>() };
    try {
      const [receipts, items] = await Promise.all([todaysReceipts(db, businessDate(now())), pendingItems(db)]);
      const waiting = new Set<string>();
      for (const item of items) if (item.kind === "cancel") item.clientReceiptIds.forEach((id) => waiting.add(id));
      return { receipts, waiting };
    } catch {
      return { receipts: [], waiting: new Set<string>() };
    }
  }, [db, now]);

  const load = useCallback(
    async (cursor?: string): Promise<void> => {
      const kept = await readLocal();
      setLoadError(null);
      setLocal(kept);
      setClock(now());
      if (connectionStore.get().forced) {
        setLoading(false);
        return;
      }
      const date = businessDate(now());
      try {
        const answer = await apis.receipts.list({ from: date, to: date, ...(cursor ? { cursor } : {}) });
        connectionStore.markOnline();
        setServer((prev) =>
          cursor && prev ? { rows: [...prev.rows, ...answer.rows], nextCursor: answer.nextCursor } : answer,
        );
      } catch (err) {
        if (isUnreachable(err)) connectionStore.markOffline(now());
        else setLoadError(messageOf(err));
      } finally {
        setLoading(false);
      }
    },
    [apis, now, readLocal],
  );

  /** The counter's slip settings and rules: from the office, else the copy this PC kept from the counter. */
  const getBootstrap = useCallback(async (): Promise<CounterBootstrap | null> => {
    if (bootstrapRef.current) return bootstrapRef.current;
    if (!me.counter) return null;
    let boot: CounterBootstrap | null = null;
    try {
      boot = await apis.counter.bootstrap();
    } catch {
      try {
        boot = db ? ((await db.get("catalogue", "current")) ?? null) : null;
      } catch {
        boot = null;
      }
    }
    if (boot) {
      bootstrapRef.current = boot;
      setBootWindow(boot.rules.cancelWindowMinutes);
    }
    return boot;
  }, [apis, db, me.counter]);

  /** Sends this PC's outbox, then reloads when anything went. */
  const sync = useCallback(async (): Promise<void> => {
    if (!db || connectionStore.get().forced) return;
    try {
      const summary = await runSync({ db, api: apis.counter });
      if (summary.sent > 0) await load();
    } catch {
      // A sign-in or PC problem: the counter page shows it; the outbox keeps everything.
    }
  }, [apis, db, load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Data fetching pattern (state is set after awaits)
    void load();
    void getBootstrap();
    if (db) void refreshWaiting(db).catch(() => undefined);
  }, [load, getBootstrap, db]);

  useEffect(() => {
    const goOnline = (): void => {
      void (async () => {
        await sync();
        await load();
      })();
    };
    const goOffline = (): void => connectionStore.markOffline(now());
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const tick = window.setInterval(() => {
      setClock(now());
      if (connectionStore.get().waiting > 0) void sync();
    }, TICK_MS);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(tick);
    };
  }, [load, now, sync]);

  const rows = useMemo(() => mergeRows(server, local.receipts, local.waiting, me.counter), [server, local, me.counter]);
  const cards = useMemo(() => toCards(rows).filter((card) => matches(card, query)), [rows, query]);
  const rowContext: RowContext = { me, can, now: clock, windowMinutes, offline };

  async function markLocalCancelled(targets: TodayRow[]): Promise<void> {
    const clientIds = targets.map((r) => r.clientReceiptId).filter((id): id is string => id !== null);
    if (!db || clientIds.length === 0) return;
    try {
      const tx = db.transaction("today", "readwrite");
      await runTransaction(tx, () => updateLocalReceipts(tx.store, clientIds, (r) => ({ ...r, status: "cancelled" })));
    } catch {
      // Only this PC's copy; the office already has the cancel.
    }
  }

  async function queueCancel(targets: TodayRow[], choice: CancelChoice): Promise<boolean> {
    const ctx: RowContext = { ...rowContext, now: now(), offline: true };
    const allowed = targets.every((r) => rowActions(r, ctx).cancel);
    if (!db || !allowed) {
      setCancelError(TODAY_ERRORS.offlineNotAllowed.en);
      return false;
    }
    await enqueueCancel(db, {
      kind: "cancel",
      clientReceiptIds: targets.map((r) => r.clientReceiptId).filter((id): id is string => id !== null),
      reasonCode: choice.reasonCode,
      ...(choice.note !== undefined ? { note: choice.note } : {}),
      at: now().toISOString(),
      cancelledByStaffNo: me.staffNo,
    });
    setNotice({
      tone: "ok",
      lines: [CANCEL_DONE.offline(CANCEL_DONE.receipts(targets.length)), moneyBackLine(targets, { today, offline: true })],
    });
    return true;
  }

  async function confirmCancel(choice: CancelChoice): Promise<void> {
    const byKey = new Map((cancelFor ?? []).map((r) => [r.key, r]));
    const targets = choice.receipts.map((c) => byKey.get(c.key)).filter((r): r is TodayRow => r !== undefined);
    if (targets.length === 0) return;
    setCancelBusy(true);
    setCancelError(null);
    setNotice(null);
    try {
      const useOutbox = offline || targets.some((r) => r.id === null);
      if (!useOutbox) {
        try {
          const answer = await apis.receipts.cancel({
            receiptIds: targets.map((r) => r.id).filter((id): id is string => id !== null),
            reasonCode: choice.reasonCode,
            ...(choice.note !== undefined ? { note: choice.note } : {}),
          });
          connectionStore.markOnline();
          await markLocalCancelled(targets);
          setNotice({
            tone: "ok",
            lines: [CANCEL_DONE.online(CANCEL_DONE.receipts(targets.length)), ...cancelResultLines(answer.receipts)],
          });
          setCancelFor(null);
          await load();
          return;
        } catch (err) {
          if (!isUnreachable(err)) {
            setCancelError(messageOf(err));
            return;
          }
          // The office did not answer: an own cancel inside the window waits in the outbox instead (sending it
          // twice is harmless - an already cancelled receipt counts as done).
          connectionStore.markOffline(now());
        }
      }
      if (await queueCancel(targets, choice)) {
        setCancelFor(null);
        await load();
      }
    } catch (err) {
      setCancelError(messageOf(err));
    } finally {
      setCancelBusy(false);
    }
  }

  async function reprint(row: TodayRow): Promise<void> {
    setNotice(null);
    const id = row.id;
    if (id === null) return;
    try {
      const boot = await getBootstrap();
      if (!boot) {
        setNotice({ tone: "error", lines: [REPRINT.noSlipSettings] });
        return;
      }
      const detail = await apis.receipts.get(id);
      const answer = await apis.counter.prints([id]);
      const duplicate = answer.receipts.find((r) => r.id === id)?.duplicate ?? true;
      const model = toSlipModel(detail, boot.slip, {
        siteUrl: boot.siteUrl,
        ...(duplicate ? { reprint: { at: now(), byStaffNo: me.staffNo } } : {}),
      });
      await printSlips([model]);
      setNotice({ tone: "ok", lines: [duplicate ? REPRINT.done(shortNo(row.receiptNo)) : REPRINT.printed(shortNo(row.receiptNo))] });
      await load();
    } catch (err) {
      setNotice({ tone: "error", lines: [{ en: messageOf(err), kn: TODAY_ERRORS.generic.kn }] });
    }
  }

  async function confirmSpoiled(): Promise<void> {
    const old = spoiledFor;
    if (!old || old.id === null) return;
    setSpoiledBusy(true);
    setSpoiledError(null);
    setNotice(null);
    let reissued = false;
    try {
      const boot = await getBootstrap();
      if (!boot) {
        setSpoiledError(REPRINT.noSlipSettings.en);
        return;
      }
      const answer = await apis.receipts.reissue(old.id);
      reissued = true;
      // The answer is the whole order: the new receipt takes the spoiled one's place in it.
      const fresh =
        answer.receipts.find((r) => r.status === "issued" && r.receiptNo !== old.receiptNo && r.position === old.position) ??
        answer.receipts.find((r) => r.status === "issued" && r.printCount === 0);
      // The dialog closes before the print job, so only the slip is on the page when it prints.
      setSpoiledFor(null);
      if (!fresh) throw new SevaClientError("bad_response", 200, TODAY_ERRORS.generic.en);
      await printSlips([toSlipModel(fresh, boot.slip, { siteUrl: boot.siteUrl })]);
      if (fresh.id !== null) await apis.counter.prints([fresh.id]);
      if (db) {
        await markLocalCancelled([old]);
        await rememberReceipts(db, [fresh], true).catch(() => undefined);
      }
      setNotice({ tone: "ok", lines: [SPOILED.done(fresh.receiptNo, shortNo(old.receiptNo))] });
    } catch (err) {
      const onlyToday = err instanceof SevaClientError && err.code === "validation" && err.detail?.field === "reissue_only_today";
      if (reissued) setNotice({ tone: "error", lines: [{ en: messageOf(err), kn: TODAY_ERRORS.generic.kn }] });
      else setSpoiledError(onlyToday ? SPOILED.onlyToday.en : messageOf(err));
    } finally {
      setSpoiledBusy(false);
      if (reissued) await load();
    }
  }

  function openCancel(card: TodayRow[]): void {
    const allowed = card.filter((r) => rowActions(r, rowContext).cancel);
    if (allowed.length === 0) return;
    setCancelError(null);
    setCancelFor(allowed);
  }

  function renderActions(row: TodayRow, actions: RowActions, inGroup: boolean): JSX.Element | null {
    const label = inGroup ? ` ${shortNo(row.receiptNo)}` : "";
    if (!actions.reprint && !actions.spoiled) return null;
    return (
      <span className="flex flex-wrap items-center gap-2">
        {actions.reprint ? (
          <ReprintButton onReprint={() => reprint(row)} label={inGroup ? `${TODAY.reprint}${label}` : undefined} />
        ) : null}
        {actions.spoiled ? (
          <Button
            type="button"
            variant="seva-ghost"
            size="sm"
            aria-label={inGroup ? `${TODAY.spoiled}${label}` : undefined}
            onClick={() => {
              setSpoiledError(null);
              setSpoiledFor(row);
            }}
          >
            {TODAY.spoiled}
          </Button>
        ) : null}
      </span>
    );
  }

  function renderMoneyLine(row: TodayRow): JSX.Element | null {
    const line = cancelledLine(row);
    return line ? <Bilingual as="div" en={line.en} kn={line.kn} className="text-(length:--text-meta) text-(--muted-foreground)" /> : null;
  }

  function renderCard(card: TodayRow[]): JSX.Element {
    const first = card[0];
    const isGroup = card.length > 1 || first.count > 1;
    const allCancelled = card.every((r) => r.status === "cancelled");
    const total = card.reduce((sum, r) => sum + r.totalPaise, 0);
    const actions = card.map((r) => rowActions(r, rowContext));
    const canCancel = actions.some((a) => a.cancel);
    const note = actions.find((a, i) => card[i].status === "issued")?.note ?? null;

    return (
      <article
        key={isGroup ? `group:${first.groupNo}` : first.key}
        aria-label={isGroup ? TODAY.group(first.groupNo) : first.receiptNo}
        className="flex flex-col gap-2 rounded-(--radius-surface) border border-(--border) bg-(--card) p-4 shadow-(--shadow-card)"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <b className="tabular-nums">{isGroup ? TODAY.group(first.groupNo) : first.receiptNo}</b>
          <span className="flex items-center gap-2">
            {allCancelled ? <Chip tone="neutral">{TODAY.cancelled.en}</Chip> : null}
            {card.some((r) => r.waiting) ? <Chip tone="attention">{TODAY.waitingBadge.en}</Chip> : null}
            <span className="text-(length:--text-meta) text-(--muted-foreground) tabular-nums">{istClock(first.issuedAt)}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{first.devoteeName}</span>
          <b className="tabular-nums">{rupees(total)}</b>
        </div>

        {isGroup ? (
          <ul className="flex flex-col gap-2">
            {card.map((r, i) => (
              <li key={r.key} className="flex flex-col gap-1 border-t border-(--border) pt-2">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-(length:--text-meta) tabular-nums">
                    {`${shortNo(r.receiptNo)} - ${r.sevaDate ? formatSevaDate(r.sevaDate) : r.sevas}`}
                  </span>
                  {r.status === "cancelled" && !allCancelled ? <Chip tone="neutral">{TODAY.cancelled.en}</Chip> : null}
                </span>
                {renderMoneyLine(r)}
                {renderActions(r, actions[i], true)}
              </li>
            ))}
            <li className="text-(length:--text-meta) text-(--muted-foreground)">
              {`${modeLabel(first.mode)}, ${TODAY.paidTogether.en}`}
            </li>
          </ul>
        ) : (
          <>
            <p className="text-(length:--text-meta) text-(--muted-foreground)">
              {[first.sevas, first.sevaDate ? (first.sevaDate === today ? "today" : shortDate(first.sevaDate)) : null, modeLabel(first.mode)]
                .filter((part): part is string => part !== null && part !== "")
                .join(" - ")}
            </p>
            {renderMoneyLine(first)}
          </>
        )}

        {canCancel || note || (!isGroup && (actions[0].reprint || actions[0].spoiled)) ? (
          <div className="flex flex-wrap items-center gap-2">
            {!isGroup ? renderActions(first, actions[0], false) : null}
            {canCancel ? (
              <Button type="button" variant="seva-secondary" size="sm" onClick={() => openCancel(card)}>
                {TODAY.cancel}
              </Button>
            ) : null}
            {note ? <span className="text-(length:--text-meta) text-(--muted-foreground)">{note.en}</span> : null}
          </div>
        ) : null}
      </article>
    );
  }

  const staffNoText = String(me.staffNo).padStart(3, "0");
  const metaLine = [me.counter?.name ?? null, `${me.name} (${staffNoText})`, formatSevaDate(today), `now ${istClock(clock)}`]
    .filter((part): part is string => part !== null)
    .join(" - ");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-(length:--text-meta) text-(--muted-foreground)">{metaLine}</p>

      {offline ? (
        <div role="status" className="rounded-(--radius-control) border border-(--border) bg-(--attn-soft) px-4 py-3">
          <Bilingual as="div" en={TODAY.offline.en} kn={TODAY.offline.kn} className="text-(length:--text-ui)" />
        </div>
      ) : null}
      {connection.waiting > 0 ? (
        <Bilingual
          as="div"
          en={TODAY.waitingCount(connection.waiting).en}
          kn={TODAY.waitingCount(connection.waiting).kn}
          className="text-(length:--text-meta) font-semibold text-(--foreground)"
        />
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Bilingual
          as="label"
          htmlFor={`${ids}-q`}
          en={TODAY.searchLabel.en}
          kn={TODAY.searchLabel.kn}
          className="text-(length:--text-meta) font-semibold text-(--foreground)"
        />
        <input
          id={`${ids}-q`}
          type="search"
          autoComplete="off"
          placeholder={TODAY.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={sevaControlClass}
        />
      </div>

      <div aria-live="polite">
        {notice ? (
          <div
            role={notice.tone === "error" ? "alert" : "status"}
            className={
              notice.tone === "error"
                ? "flex flex-col gap-1 rounded-(--radius-control) border border-(--destructive) bg-(--destructive-soft) px-4 py-3 text-(--destructive)"
                : "flex flex-col gap-1 rounded-(--radius-control) border border-(--border) bg-(--ok-soft) px-4 py-3 text-(--foreground)"
            }
          >
            {notice.lines.map((line) => (
              <Bilingual key={line.en} as="div" en={line.en} kn={line.kn} className="text-(length:--text-ui) font-semibold" />
            ))}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div role="status" className="py-8 text-center">
          <Bilingual en={TODAY.loading.en} kn={TODAY.loading.kn} className="text-(--muted-foreground)" />
        </div>
      ) : loadError ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="font-semibold text-(--foreground)">{loadError}</p>
          <Button type="button" variant="seva-primary" onClick={() => void load()}>
            {TODAY.tryAgain}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <Bilingual as="div" en={TODAY.empty.en} kn={TODAY.empty.kn} className="py-8 text-center text-(--muted-foreground)" />
      ) : cards.length === 0 ? (
        <Bilingual as="div" en={TODAY.noMatch.en} kn={TODAY.noMatch.kn} className="py-8 text-center text-(--muted-foreground)" />
      ) : (
        <div className="flex flex-col gap-3">{cards.map(renderCard)}</div>
      )}

      {!loading && !offline && server?.nextCursor ? (
        <Button
          type="button"
          variant="seva-secondary"
          loading={loadingMore}
          onClick={() => {
            const cursor = server.nextCursor;
            if (!cursor) return;
            setLoadingMore(true);
            void load(cursor).finally(() => setLoadingMore(false));
          }}
        >
          {TODAY.showMore}
        </Button>
      ) : null}

      <Bilingual as="div" en={TODAY.footer.en} kn={TODAY.footer.kn} className="text-(length:--text-meta) text-(--muted-foreground)" />

      {cancelFor ? (
        <CancelDialog
          key={cancelFor.map((r) => r.key).join("|")}
          open
          receipts={cancelFor}
          today={today}
          offline={offline}
          busy={cancelBusy}
          error={cancelError}
          onConfirm={(choice) => void confirmCancel(choice)}
          onClose={() => setCancelFor(null)}
        />
      ) : null}
      {spoiledFor ? (
        <SpoiledDialog
          open
          receiptNo={spoiledFor.receiptNo}
          devoteeName={spoiledFor.devoteeName}
          busy={spoiledBusy}
          error={spoiledError}
          onConfirm={() => void confirmSpoiled()}
          onClose={() => setSpoiledFor(null)}
        />
      ) : null}
    </div>
  );
}

export default TodayList;
