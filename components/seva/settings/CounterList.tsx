"use client";

import { useCallback, useEffect, useState, type FormEvent, type JSX } from "react";
import { AnimatePresence, m } from "framer-motion";

import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { enterVariants } from "@/lib/seva/motion";
import { fromPaise, toPaise } from "@/lib/seva/money";
import { parseReceiptNo } from "@/lib/seva/numbering";
import type { Bi } from "@/lib/seva/strings/common";
import { addCounterLabel, alreadyOtherCounter, nowThisPc, RS } from "@/lib/seva/strings/receipt-settings";
import type { CounterRequest } from "@/lib/seva/schemas";
import type { ContinuityRow } from "@/types/seva-reports";
import type { CounterItem, NewCounter } from "@/types/seva-settings";

import { errorText, Notice, SettingsCard, TextField } from "./ReceiptSettingsFields";
import { RegisterThisPc } from "./RegisterThisPc";
import { ReplaceThisPc } from "./ReplaceThisPc";

/**
 * Settings - Counters (DB §13.2, §8.4): each counter with its online (C<n>) and offline (OF<n>) series and the last
 * numbers this year, its opening float, "Register this PC" and "Replace this PC", and "+ Add a counter (C2 and OF2)".
 * The last numbers come from the register's continuity report for 1 January to today (the same source as Reports).
 * View-only temple admins see everything with nothing to change; the server refuses their writes anyway.
 */

export interface CounterListApi {
  listCounters(): Promise<CounterItem[]>;
  addCounter(input: Pick<CounterRequest, "name" | "place">): Promise<NewCounter>;
  updateCounter(id: number, patch: Partial<CounterRequest>): Promise<void>;
  continuity(from: string, to: string): Promise<ContinuityRow[]>;
  registerDevice(b: { counterId: number; secretHash: string; label: string }): Promise<{ deviceId: string }>;
  replaceDevice(b: { counterId: number; secretHash: string; label: string; lastPrintedOfNo: number; reason: string }): Promise<{
    deviceId: string;
  }>;
}

export interface CounterListProps {
  api: CounterListApi;
  /** settings.edit: add counters and change the opening float. */
  canEdit: boolean;
  /** device.register: register or replace this PC. */
  canRegister: boolean;
  /** The counter this PC is registered as (from the verified device header), or null. */
  thisPcCounterId: number | null;
  /** The current IST year and business date, for the last numbers. */
  year: number;
  today: string;
  /** Called after this PC was registered or replaced as a counter. */
  onThisPcChanged?(counterId: number): void;
}

type Load = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; counters: CounterItem[]; last: Map<string, string | null> };

function rupeesToPaise(text: string): number | null {
  const t = text.replace(/^\s*(rs\.?|₹)\s*/i, "").replace(/,/g, "").trim();
  if (t === "") return null;
  try {
    return toPaise(t);
  } catch {
    return null;
  }
}

function floatText(paise: number): string {
  return fromPaise(paise).replace(/\.00$/, "");
}

function SeriesBadge({ label, series }: { label: Bi; series: string | null }): JSX.Element | null {
  if (!series) return null;
  return (
    <span className="rounded-(--radius-pill) border border-(--border) px-2.5 py-0.5 text-(length:--text-meta)">
      {`${label.en} ${series}`}
      <span className="kn inline" lang="kn">{` ${label.kn}`}</span>
    </span>
  );
}

function OpeningFloat({
  counter,
  canEdit,
  save,
}: {
  counter: CounterItem;
  canEdit: boolean;
  save(paise: number): Promise<void>;
}): JSX.Element {
  const [text, setText] = useState(floatText(counter.openingFloatPaise));
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: Bi | string } | null>(null);
  const paise = rupeesToPaise(text);

  async function submit(e: FormEvent) {
    e.preventDefault();
    // A view-only admin's field is read-only with no button, but a one-field form still submits on Enter.
    if (!canEdit) return;
    setChecked(true);
    if (paise === null || busy) return;
    setBusy(true);
    setResult(null);
    try {
      await save(paise);
      setResult({ kind: "ok", text: RS.saved });
    } catch (err) {
      setResult({ kind: "error", text: errorText(err, RS.loadFailed) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-2">
      <TextField
        id={`counter-${counter.id}-float`}
        label={RS.openingFloat}
        hint={RS.openingFloatHint}
        value={text}
        onChange={(v) => {
          setText(v);
          setResult(null);
        }}
        inputMode="decimal"
        readOnly={!canEdit}
        maxLength={12}
        error={checked && paise === null ? RS.floatInvalid.en : null}
        className="w-full max-w-[16rem]"
      />
      {canEdit ? (
        <PendingButton type="submit" variant="seva-secondary" pending={busy} pendingLabel={RS.saving.en}>
          {RS.saveFloat.en}
        </PendingButton>
      ) : null}
      {result ? (
        <div className="w-full">
          <Notice kind={result.kind} text={result.text} />
        </div>
      ) : null}
    </form>
  );
}

function AddCounter({ nextNo, add }: { nextNo: number; add(input: { name: string; place: string | null }): Promise<void> }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = addCounterLabel(nextNo);

  if (!open) {
    return (
      <Button type="button" variant="seva-secondary" size="sm" onClick={() => setOpen(true)}>
        {label.en}
      </Button>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setChecked(true);
    if (name.trim() === "" || busy) return;
    setBusy(true);
    setError(null);
    try {
      await add({ name: name.trim(), place: place.trim() === "" ? null : place.trim() });
      setOpen(false);
      setName("");
      setPlace("");
      setChecked(false);
    } catch (err) {
      setError(errorText(err, RS.loadFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex w-full flex-col gap-3 rounded-(--radius-control) border border-(--border) bg-(--muted) p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextField
          id="add-counter-name"
          label={RS.addCounterName}
          value={name}
          onChange={setName}
          maxLength={40}
          error={checked && name.trim() === "" ? RS.addCounterNameNeeded.en : null}
        />
        <TextField id="add-counter-place" label={RS.addCounterPlace} value={place} onChange={setPlace} maxLength={60} />
      </div>
      {error ? <Notice kind="error" text={error} /> : null}
      <div className="flex flex-wrap gap-2">
        <PendingButton type="submit" size="sm" pending={busy} pendingLabel={RS.saving.en}>
          {label.en}
        </PendingButton>
        <Button type="button" variant="seva-ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
          {RS.addCounterCancel.en}
        </Button>
      </div>
    </form>
  );
}

export function CounterList({ api, canEdit, canRegister, thisPcCounterId, year, today, onThisPcChanged }: CounterListProps): JSX.Element {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  // A PC registered or moved on this page counts at once; otherwise the verified device header says which it is.
  const [registeredHere, setRegisteredHere] = useState<number | null>(null);
  const thisPc = registeredHere ?? thisPcCounterId;
  const [notice, setNotice] = useState<Bi | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [counters, rows] = await Promise.all([
        api.listCounters(),
        // The last numbers are a help, not a must: the list still shows when the report cannot be read.
        api.continuity(`${year}-01-01`, today).catch(() => [] as ContinuityRow[]),
      ]);
      const last = new Map<string, string | null>();
      for (const row of rows) if (row.year === year) last.set(row.series, row.lastNo);
      setLoad({ kind: "ready", counters, last });
    } catch (err) {
      setLoad({ kind: "error", message: errorText(err, RS.loadFailed) });
    }
  }, [api, year, today]);

  useEffect(() => {
    // Loading from the API on arrival is the effect's job; the state is set after the call answers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  function becameThisPc(counterId: number) {
    setRegisteredHere(counterId);
    // The row's Register form goes away once this PC is a counter, so the list says what happened.
    const name = load.kind === "ready" ? load.counters.find((c) => c.id === counterId)?.name : undefined;
    setNotice(nowThisPc(name ?? `Counter ${counterId}`));
    onThisPcChanged?.(counterId);
    void refresh();
  }

  if (load.kind === "loading") {
    return (
      <div role="status" aria-live="polite" className="p-4">
        <Bilingual en={RS.loading.en} kn={RS.loading.kn} className="text-(--muted-foreground)" />
      </div>
    );
  }

  if (load.kind === "error") {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <Notice kind="error" text={load.message} />
        <Button type="button" variant="seva-primary" onClick={() => void refresh()}>
          {RS.tryAgain.en}
        </Button>
      </div>
    );
  }

  const nextNo = load.counters.reduce((m, c) => Math.max(m, c.id), 0) + 1;

  return (
    <SettingsCard
      title={RS.countersTitle}
      hint={RS.appliesAfterSave}
      testId="counter-list"
      aside={
        canEdit ? (
          <AddCounter
            nextNo={nextNo}
            add={async (input) => {
              await api.addCounter(input);
              setNotice(RS.counterAdded);
              await refresh();
            }}
          />
        ) : null
      }
    >
      {notice ? <Notice kind="ok" text={notice} /> : null}
      {load.counters.length === 0 ? <Bilingual as="div" en={RS.noCounters.en} kn={RS.noCounters.kn} className="meta" /> : null}
      <ul className="m-0 flex list-none flex-col p-0">
        {/* A counter added here springs in; the ones there on arrival do not move (plan A4P-4). */}
        <AnimatePresence initial={false}>
          {load.counters.map((c) => {
            const lastC = c.onlineSeries ? load.last.get(c.onlineSeries) ?? null : null;
            const lastOf = c.offlineSeries ? load.last.get(c.offlineSeries) ?? null : null;
            const lastOfNo = lastOf ? parseReceiptNo(lastOf)?.running ?? null : load.last.size > 0 ? 0 : null;
            const isThisPc = thisPc === c.id;
            const otherLine =
              thisPc !== null && !isThisPc
                ? alreadyOtherCounter(load.counters.find((x) => x.id === thisPc)?.name ?? `Counter ${thisPc}`)
                : null;
            return (
              <m.li
                key={c.id}
                data-counter={c.id}
                variants={enterVariants}
                initial="hidden"
                animate="shown"
                exit="hidden"
                className="flex flex-col gap-3 border-t border-(--border) py-4 first:border-t-0 first:pt-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{c.name}</strong>
                  {c.place ? <span className="meta">{`· ${c.place}`}</span> : null}
                  {isThisPc ? (
                    <span className="rounded-(--radius-pill) bg-(--ok-soft) px-2.5 py-0.5 text-(length:--text-meta) font-semibold">
                      {RS.thisPc.en}
                      <span className="kn inline" lang="kn">{` ${RS.thisPc.kn}`}</span>
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <SeriesBadge label={RS.counterOnline} series={c.onlineSeries} />
                  <SeriesBadge label={RS.counterOffline} series={c.offlineSeries} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <Bilingual en={RS.lastNumbers.en} kn={RS.lastNumbers.kn} className="meta" />
                  {lastC || lastOf ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-(length:--text-ui) tabular-nums">
                      {lastC ? <span>{lastC}</span> : null}
                      {lastOf ? <span>{lastOf}</span> : null}
                    </div>
                  ) : (
                    <Bilingual en={RS.noNumbersYet.en} kn={RS.noNumbersYet.kn} className="meta" />
                  )}
                </div>
                <OpeningFloat counter={c} canEdit={canEdit} save={(paise) => api.updateCounter(c.id, { openingFloatPaise: paise })} />
                {/* A PC is one counter (A4 security L-1). A PC that is not a counter yet may register as any counter or take
                    one over; a PC that is already a counter is offered only Replace, for that same counter (a new key), and
                    nothing on the other rows, so its key and its unsent receipts are never orphaned by a second counter. */}
                {canRegister && thisPc === null ? (
                  <div className="flex flex-wrap items-start gap-2">
                    <RegisterThisPc counter={c} register={api.registerDevice} onRegistered={becameThisPc} />
                    <ReplaceThisPc counter={c} lastOfNo={lastOfNo} year={year} replace={api.replaceDevice} onReplaced={becameThisPc} />
                  </div>
                ) : null}
                {canRegister && isThisPc ? (
                  <div className="flex flex-wrap items-start gap-2">
                    <ReplaceThisPc counter={c} lastOfNo={lastOfNo} year={year} replace={api.replaceDevice} onReplaced={becameThisPc} />
                  </div>
                ) : null}
                {canRegister && otherLine ? <Bilingual as="div" en={otherLine.en} kn={otherLine.kn} className="meta" /> : null}
              </m.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </SettingsCard>
  );
}

export default CounterList;
