"use client";

import { useId, useState, type JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { sevaControlClass } from "@/components/ui/input";
import { isSevaErrorCode, sevaErrorMessage } from "@/lib/seva/errors";
import { reasonLength, SET_ASIDE_REASON_MIN, type RefusedItem } from "@/lib/seva/offline/refused";
import { COUNTER_TEXT, rupees } from "@/lib/seva/strings/counter";

export interface RefusedOutboxProps {
  items: RefusedItem[];
  /** A temple admin may set an item aside on this PC. */
  canSetAside: boolean;
  onSetAside(seq: number, reason: string): Promise<void>;
}

function codeText(code: string): string {
  return isSevaErrorCode(code) ? sevaErrorMessage(code) : code;
}

/**
 * Outbox items the office refused (Design Book 8.3, review M-5): what each one is, why the office refused it and what
 * to do next. A temple admin sets one aside after its paper-book entry, with a reason; it then leaves the outbox and no
 * longer holds up the day close.
 */
export function RefusedOutbox({ items, canSetAside, onSetAside }: RefusedOutboxProps): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <section
      role="alert"
      aria-label={COUNTER_TEXT.refusedTitle.en}
      className="flex flex-col gap-3 rounded-(--radius-surface) border border-(--border-strong) bg-(--secondary) px-5 py-4"
    >
      <Bilingual en={COUNTER_TEXT.refusedTitle.en} kn={COUNTER_TEXT.refusedTitle.kn} className="font-semibold" />
      <Bilingual as="div" en={COUNTER_TEXT.refusedNext.en} kn={COUNTER_TEXT.refusedNext.kn} className="text-(length:--text-ui)" />
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((item) => (
          <RefusedRow key={item.seq} item={item} canSetAside={canSetAside} onSetAside={onSetAside} />
        ))}
      </ul>
    </section>
  );
}

function RefusedRow({ item, canSetAside, onSetAside }: { item: RefusedItem; canSetAside: boolean; onSetAside: RefusedOutboxProps["onSetAside"] }): JSX.Element {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const reasonOk = reasonLength(reason) >= SET_ASIDE_REASON_MIN;

  async function confirm(): Promise<void> {
    if (!reasonOk || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSetAside(item.seq, reason.trim());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-(--radius-control) border border-(--border) bg-(--card) px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <b>{item.kind === "order" ? COUNTER_TEXT.refusedKindOrder : COUNTER_TEXT.refusedKindCancel}</b>
        <span className="num">{item.receiptNos.join(", ")}</span>
        <span className="amount">{rupees(item.totalPaise)}</span>
      </div>
      <span className="meta">{codeText(item.code)}</span>
      {canSetAside && !open ? (
        <div>
          <Button type="button" variant="seva-secondary" size="sm" onClick={() => setOpen(true)}>
            {COUNTER_TEXT.refusedSetAside}
          </Button>
        </div>
      ) : null}
      {canSetAside && open ? (
        <div className="flex flex-col gap-2">
          <span className="meta">{COUNTER_TEXT.refusedNextAdmin}</span>
          <label htmlFor={`${id}-reason`} className="text-(length:--text-meta) font-semibold">
            {COUNTER_TEXT.refusedReasonLabel}
          </label>
          <input
            id={`${id}-reason`}
            className={sevaControlClass}
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            aria-describedby={`${id}-hint`}
          />
          <span id={`${id}-hint`} className="meta">
            {reasonOk ? "" : COUNTER_TEXT.refusedReasonShort}
          </span>
          {failed ? (
            <span role="status" className="text-(length:--text-ui)">
              {COUNTER_TEXT.refusedSetAsideFailed}
            </span>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="seva-primary" size="sm" disabled={!reasonOk || busy} onClick={() => void confirm()}>
              {COUNTER_TEXT.refusedConfirm}
            </Button>
            <Button type="button" variant="seva-ghost" size="sm" onClick={() => setOpen(false)}>
              {COUNTER_TEXT.refusedKeep}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export default RefusedOutbox;
