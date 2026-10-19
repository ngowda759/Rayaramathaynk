"use client";

import { useState, type FormEvent, type JSX } from "react";

import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { parseReceiptNo } from "@/lib/seva/numbering";
import type { Bi } from "@/lib/seva/strings/common";
import {
  gapRangeLine,
  largeGapConfirm,
  moveCounterLabel,
  nowThisPc,
  officeHasLine,
  replaceTitle,
  RS,
  unknownLastConfirm,
} from "@/lib/seva/strings/receipt-settings";
import type { CounterItem } from "@/types/seva-settings";

import { errorText, Notice, TextField } from "./ReceiptSettingsFields";
import { keepDeviceKey, makeDeviceKey, thisPcRefusal } from "./RegisterThisPc";

/**
 * "Replace this PC" (DB §8.4, C-52): on the new PC, a temple admin types the number on the last offline slip the old
 * PC printed and a reason. The office retires the old device, registers this one (only the hash of its new secret is
 * sent, as for Register), sets the OF running number to the typed one, and lists any numbers it never received as an
 * open gap that an admin must explain. The form warns about that gap before anything is sent.
 */

const MAX_RUNNING = 999_999;
const RUNNING_ONLY = /^\d{1,7}$/;
/** A gap wider than this many numbers needs a second confirmation (A4 security L-2). */
export const LARGE_GAP = 200;

/**
 * The running number of the last offline slip: a full receipt number of this counter's OF series for this IST year
 * ('OF1-023-10-2026/000007' -> 7 in 2026) or the running number alone ('7'). Null for anything else: a number of
 * another series (a C1 slip is never sent offline, so it says nothing about the gap) or of another year (the running
 * number starts again on 1 January, so last year's slip would set this year's number far too high).
 */
export function parseLastSlip(text: string, offlineSeries: string, year: number): number | null {
  const t = text.trim();
  if (t === "") return null;
  if (RUNNING_ONLY.test(t)) {
    const n = Number(t);
    return n <= MAX_RUNNING ? n : null;
  }
  const parts = parseReceiptNo(t);
  if (!parts || parts.series !== offlineSeries.toUpperCase() || parts.year !== year) return null;
  return parts.running;
}

/**
 * The line to confirm a second time before Replace, or null when none is needed: when the office's last number is
 * not known (and the typed one is above 0), or when the typed number leaves more than LARGE_GAP numbers as a gap.
 */
export function secondLookLine(series: string, typed: number, lastOfNo: number | null): Bi | null {
  if (lastOfNo === null) return typed > 0 ? unknownLastConfirm(series, typed) : null;
  return typed - lastOfNo > LARGE_GAP ? largeGapConfirm(series, lastOfNo + 1, typed) : null;
}

type ReplaceBody = { counterId: number; secretHash: string; label: string; lastPrintedOfNo: number; reason: string };

export interface ReplaceThisPcProps {
  counter: CounterItem;
  /** The last OF running number the office holds this year, when known (from the continuity report). */
  lastOfNo: number | null;
  /** The current IST year: a full slip number of another year is refused. */
  year: number;
  replace(b: ReplaceBody): Promise<{ deviceId: string }>;
  onReplaced(counterId: number): void;
}

type Phase =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "confirm"; typed: number; line: Bi }
  | { kind: "busy" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export function ReplaceThisPc({ counter, lastOfNo, year, replace, onReplaced }: ReplaceThisPcProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: "closed" });
  const [lastText, setLastText] = useState("");
  const [reason, setReason] = useState("");
  const [label, setLabel] = useState(counter.place ?? "");
  const [checked, setChecked] = useState(false);
  const series = counter.offlineSeries ?? `OF${counter.id}`;
  const formId = `replace-pc-${counter.id}`;

  const typed = parseLastSlip(lastText, series, year);
  const lastError = checked && typed === null ? RS.lastSlipInvalid.en : null;
  const reasonError = checked && Array.from(reason.trim()).length < 3 ? RS.reasonTooShort.en : null;
  const gap = typed !== null && lastOfNo !== null && typed > lastOfNo ? gapRangeLine(series, lastOfNo + 1, typed) : null;
  const move = moveCounterLabel(counter.name);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (phase.kind === "busy") return;
    setChecked(true);
    if (typed === null || Array.from(reason.trim()).length < 3) return;
    const line = secondLookLine(series, typed, lastOfNo);
    if (line) {
      setPhase({ kind: "confirm", typed, line });
      return;
    }
    await send(typed);
  }

  async function send(lastPrintedOfNo: number) {
    const trimmedReason = reason.trim();
    // The reason can change while the second look is open, so the check runs again here before anything is sent.
    if (Array.from(trimmedReason).length < 3) {
      setChecked(true);
      setPhase({ kind: "open" });
      return;
    }
    setPhase({ kind: "busy" });
    const refusal = await thisPcRefusal("replace");
    if (refusal) {
      setPhase({ kind: "error", message: refusal });
      return;
    }
    let deviceId: string;
    let secret: string;
    try {
      const key = await makeDeviceKey();
      secret = key.secret;
      const answer = await replace({
        counterId: counter.id,
        secretHash: key.secretHash,
        label: label.trim(),
        lastPrintedOfNo,
        reason: trimmedReason,
      });
      deviceId = answer.deviceId;
    } catch (err) {
      setPhase({ kind: "error", message: errorText(err, RS.loadFailed) });
      return;
    }
    try {
      await keepDeviceKey(deviceId, secret);
    } catch {
      setPhase({ kind: "error", message: RS.registerNotKept.en });
      return;
    }
    setPhase({ kind: "done" });
    onReplaced(counter.id);
  }

  if (phase.kind === "closed") {
    return (
      <Button type="button" variant="seva-secondary" size="sm" onClick={() => setPhase({ kind: "open" })} aria-controls={formId}>
        {RS.replace.en}
      </Button>
    );
  }

  if (phase.kind === "done") {
    return <Notice kind="ok" text={nowThisPc(counter.name)} />;
  }

  const busy = phase.kind === "busy";
  const title = replaceTitle(counter.name);
  return (
    <form id={formId} onSubmit={submit} noValidate className="flex w-full flex-col gap-3 rounded-(--radius-control) border border-(--border) bg-(--muted) p-3">
      <div className="flex flex-col gap-1">
        <Bilingual as="div" en={title.en} kn={title.kn} className="font-semibold" />
        <Bilingual as="div" en={RS.replaceHint.en} kn={RS.replaceHint.kn} className="meta" />
      </div>
      <TextField
        id={`${formId}-last`}
        label={RS.lastSlip}
        hint={RS.lastSlipHint}
        value={lastText}
        onChange={(v) => {
          setLastText(v);
          // A changed number needs its own second look.
          if (phase.kind === "confirm") setPhase({ kind: "open" });
        }}
        placeholder={`${series}-000-00-0000/000000`}
        maxLength={40}
        error={lastError}
        className="max-w-sm"
      />
      <TextField
        id={`${formId}-reason`}
        label={RS.reason}
        hint={RS.reasonHint}
        value={reason}
        onChange={setReason}
        maxLength={200}
        error={reasonError}
        multiline
        className="max-w-xl"
      />
      <TextField id={`${formId}-label`} label={RS.pcLabel} value={label} onChange={setLabel} maxLength={120} className="max-w-sm" />
      <div role="note" className="flex flex-col gap-1 rounded-(--radius-control) border border-(--border-strong) bg-(--attn-soft) p-3">
        <Bilingual as="div" en={RS.gapWarning.en} kn={RS.gapWarning.kn} />
        {lastOfNo !== null ? (
          <Bilingual as="div" en={officeHasLine(series, lastOfNo).en} kn={officeHasLine(series, lastOfNo).kn} className="meta" />
        ) : null}
        {gap ? <Bilingual as="div" en={gap.en} kn={gap.kn} className="font-semibold" /> : null}
      </div>
      {phase.kind === "error" ? <Notice kind="error" text={phase.message} /> : null}
      {phase.kind === "confirm" ? (
        <div role="alert" className="flex flex-col gap-2 rounded-(--radius-control) border border-(--border-strong) bg-(--attn-soft) p-3">
          <Bilingual as="div" en={phase.line.en} kn={phase.line.kn} className="font-semibold" />
          <div>
            <Button type="button" variant="seva-primary" size="sm" onClick={() => void send(phase.typed)}>
              {RS.confirmLastSlip.en}
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <PendingButton
          type="submit"
          variant={phase.kind === "confirm" ? "seva-secondary" : "seva-primary"}
          size="sm"
          pending={busy}
          pendingLabel={RS.replacing.en}
        >
          {move.en}
        </PendingButton>
        <Button type="button" variant="seva-ghost" size="sm" disabled={busy} onClick={() => setPhase({ kind: "closed" })}>
          {RS.cancel.en}
        </Button>
      </div>
    </form>
  );
}

export default ReplaceThisPc;
