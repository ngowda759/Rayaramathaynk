"use client";

import { useId, useMemo, useState, type JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { sevaControlClass } from "@/components/ui/input";
import { formatRupees, toPaise } from "@/lib/seva/money";
import { paperReceiptSchema, type PaperReceiptRequest } from "@/lib/seva/schemas";
import { PAPER_DIALOG } from "@/lib/seva/strings/reports";
import { cn } from "@/lib/utils";
import type { CatalogueSeva } from "@/types/seva";
import type { ContinuityGap } from "@/types/seva-reports";

export type GapStatusAfterEntry = "open" | "entered_from_paper";

export interface PaperReceiptDialogProps {
  /** The open gap whose slip is typed in; the dialog is open while it is set. */
  gap: ContinuityGap | null;
  /** The catalogue, for the seva choice and its rate. */
  sevas: CatalogueSeva[];
  /** Today's business date (IST); the slip's date cannot be later. */
  today: string;
  enter(gapId: number, body: PaperReceiptRequest): Promise<{ gapStatus: GapStatusAfterEntry }>;
  /** The office stored the slip; 'open' while other numbers of the gap are still missing. */
  onEntered(gapStatus: GapStatusAfterEntry): void;
  onClose(): void;
}

const MAX_LINES = 8;

function pad(no: number): string {
  return String(no).padStart(6, "0");
}

/** A typed rupee amount as paise; undefined when empty, null when it is not an amount. */
function paiseOf(text: string): number | undefined | null {
  if (text.trim() === "") return undefined;
  try {
    return toPaise(text);
  } catch {
    return null;
  }
}

/**
 * One slip of an open number gap typed in from the paper book (C-52, A5-FIX M-6): the number and date as printed, the
 * devotee, the sevas, the total, how it was paid and where the slip was found. The server (`gap.resolve`) stores it
 * under its printed number and closes the gap when its last number is entered; the form only checks what it can.
 */
export function PaperReceiptDialog(props: PaperReceiptDialogProps): JSX.Element {
  const { gap, onClose } = props;
  return (
    <Dialog open={gap !== null} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent variant="seva" showCloseButton={false} className="max-h-[90vh] overflow-y-auto">
        {/* Keyed on the gap so each one starts with an empty form. */}
        {gap ? <PaperForm key={gap.id} {...props} gap={gap} /> : null}
      </DialogContent>
    </Dialog>
  );
}

interface LineDraft {
  sevaId: string;
  quantity: string;
  rate: string;
}

function PaperForm({ gap, sevas, today, enter, onEntered, onClose }: PaperReceiptDialogProps & { gap: ContinuityGap }): JSX.Element {
  const ids = useId();
  const [receiptNo, setReceiptNo] = useState(`${gap.series}-`);
  const [issuedOn, setIssuedOn] = useState("");
  const [sevaDate, setSevaDate] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gotra, setGotra] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ sevaId: "", quantity: "1", rate: "" }]);
  const [total, setTotal] = useState("");
  const [mode, setMode] = useState<"cash" | "upi" | "">("");
  const [upiRef, setUpiRef] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(sevas.map((s) => [s.id, s])), [sevas]);

  /** Per line: what is wrong with its amount, if anything. */
  const lineProblems = lines.map((line): string | null => {
    const rate = paiseOf(line.rate);
    if (rate === null) return PAPER_DIALOG.badAmount;
    const chosen = byId.get(line.sevaId);
    if (chosen && chosen.ratePaise === null && rate === undefined) return PAPER_DIALOG.rateNeeded;
    return null;
  });
  const totalPaise = paiseOf(total);

  const parsed = paperReceiptSchema.safeParse({
    receiptNo,
    issuedOn,
    sevaDate,
    devotee: {
      name,
      ...(phone.trim() === "" ? {} : { phone }),
      ...(gotra.trim() === "" ? {} : { gotra: { text: gotra } }),
    },
    lines: lines.map((line) => {
      const rate = paiseOf(line.rate);
      return {
        sevaId: line.sevaId,
        quantity: Number(line.quantity),
        ...(typeof rate === "number" ? { unitRatePaise: rate } : {}),
      };
    }),
    totalPaise: typeof totalPaise === "number" ? totalPaise : undefined,
    payment: mode === "upi" ? { mode, upiRefLast6: upiRef.trim() } : { mode },
    note,
  });
  const ready = parsed.success && issuedOn <= today && lineProblems.every((p) => p === null) && !busy;

  function setLine(index: number, patch: Partial<LineDraft>): void {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function confirm(): Promise<void> {
    if (!ready || !parsed.success) return;
    setBusy(true);
    setError(null);
    try {
      const { gapStatus } = await enter(gap.id, parsed.data);
      onEntered(gapStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const label = "text-(length:--text-meta) font-semibold text-(--foreground)";
  const field = "flex flex-col gap-1.5";

  return (
    <>
      <div className="flex flex-col gap-1">
        <DialogTitle variant="seva">{PAPER_DIALOG.title(gap.series, pad(gap.fromNo), pad(gap.toNo))}</DialogTitle>
        <DialogDescription className="text-(length:--text-meta) text-(--muted-foreground)">
          <Bilingual en={PAPER_DIALOG.description.en} kn={PAPER_DIALOG.description.kn} />
        </DialogDescription>
      </div>

      <div className={field}>
        <Bilingual as="label" htmlFor={`${ids}-no`} en={PAPER_DIALOG.receiptNo.en} kn={PAPER_DIALOG.receiptNo.kn} className={label} />
        <input
          id={`${ids}-no`}
          value={receiptNo}
          maxLength={24}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${ids}-no-hint`}
          onChange={(e) => setReceiptNo(e.target.value)}
          className={cn(sevaControlClass, "font-mono tabular-nums")}
        />
        <span id={`${ids}-no-hint`} className="text-(length:--text-meta) text-(--muted-foreground)">
          {PAPER_DIALOG.receiptNoHint(gap.series)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={field}>
          <Bilingual as="label" htmlFor={`${ids}-issued`} en={PAPER_DIALOG.issuedOn.en} kn={PAPER_DIALOG.issuedOn.kn} className={label} />
          <input
            id={`${ids}-issued`}
            type="date"
            value={issuedOn}
            max={today}
            onChange={(e) => setIssuedOn(e.target.value)}
            className={sevaControlClass}
          />
        </div>
        <div className={field}>
          <Bilingual as="label" htmlFor={`${ids}-seva-date`} en={PAPER_DIALOG.sevaDate.en} kn={PAPER_DIALOG.sevaDate.kn} className={label} />
          <input
            id={`${ids}-seva-date`}
            type="date"
            value={sevaDate}
            onChange={(e) => setSevaDate(e.target.value)}
            className={sevaControlClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={field}>
          <Bilingual as="label" htmlFor={`${ids}-name`} en={PAPER_DIALOG.name.en} kn={PAPER_DIALOG.name.kn} className={label} />
          <input id={`${ids}-name`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={sevaControlClass} />
        </div>
        <div className={field}>
          <Bilingual as="label" htmlFor={`${ids}-gotra`} en={PAPER_DIALOG.gotra.en} kn={PAPER_DIALOG.gotra.kn} className={label} />
          <input id={`${ids}-gotra`} value={gotra} maxLength={60} onChange={(e) => setGotra(e.target.value)} className={sevaControlClass} />
        </div>
        <div className={field}>
          <Bilingual as="label" htmlFor={`${ids}-phone`} en={PAPER_DIALOG.phone.en} kn={PAPER_DIALOG.phone.kn} className={label} />
          <input
            id={`${ids}-phone`}
            type="tel"
            inputMode="tel"
            value={phone}
            maxLength={16}
            onChange={(e) => setPhone(e.target.value)}
            className={sevaControlClass}
          />
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {lines.map((line, index) => {
          const n = index + 1;
          const chosen = byId.get(line.sevaId);
          const problem = lineProblems[index];
          return (
            <li key={index} className="flex flex-col gap-2 rounded-(--radius-control) border border-(--border) p-3">
              <div className={field}>
                <Bilingual as="span" en={PAPER_DIALOG.seva.en} kn={PAPER_DIALOG.seva.kn} className={label} />
                <select
                  aria-label={`Seva ${n}`}
                  value={line.sevaId}
                  onChange={(e) => setLine(index, { sevaId: e.target.value })}
                  className={sevaControlClass}
                >
                  <option value="">{PAPER_DIALOG.chooseSeva}</option>
                  {sevas.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={field}>
                  <Bilingual as="label" htmlFor={`${ids}-qty-${index}`} en={PAPER_DIALOG.quantity.en} kn={PAPER_DIALOG.quantity.kn} className={label} />
                  <input
                    id={`${ids}-qty-${index}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    value={line.quantity}
                    onChange={(e) => setLine(index, { quantity: e.target.value })}
                    className={sevaControlClass}
                  />
                </div>
                <div className={field}>
                  <Bilingual as="label" htmlFor={`${ids}-rate-${index}`} en={PAPER_DIALOG.rate.en} kn={PAPER_DIALOG.rate.kn} className={label} />
                  <input
                    id={`${ids}-rate-${index}`}
                    inputMode="decimal"
                    value={line.rate}
                    aria-describedby={`${ids}-rate-${index}-hint`}
                    onChange={(e) => setLine(index, { rate: e.target.value })}
                    className={cn(sevaControlClass, "tabular-nums")}
                  />
                </div>
              </div>
              <span
                id={`${ids}-rate-${index}-hint`}
                className={cn("text-(length:--text-meta)", problem ? "font-semibold text-(--destructive)" : "text-(--muted-foreground)")}
              >
                {problem ?? (chosen && chosen.ratePaise !== null ? PAPER_DIALOG.rateHint(formatRupees(chosen.ratePaise, { decimals: chosen.ratePaise % 100 !== 0 })) : "")}
              </span>
              {lines.length > 1 ? (
                <Button
                  type="button"
                  variant="seva-ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                >
                  {PAPER_DIALOG.removeLine(n)}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {lines.length < MAX_LINES ? (
        <Button
          type="button"
          variant="seva-secondary"
          size="sm"
          className="self-start"
          onClick={() => setLines((prev) => [...prev, { sevaId: "", quantity: "1", rate: "" }])}
        >
          {PAPER_DIALOG.addLine}
        </Button>
      ) : null}

      <div className={field}>
        <Bilingual as="label" htmlFor={`${ids}-total`} en={PAPER_DIALOG.total.en} kn={PAPER_DIALOG.total.kn} className={label} />
        <input
          id={`${ids}-total`}
          inputMode="decimal"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          className={cn(sevaControlClass, "tabular-nums")}
        />
        {totalPaise === null ? (
          <span className="text-(length:--text-meta) font-semibold text-(--destructive)">{PAPER_DIALOG.badAmount}</span>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={cn(label, "mb-1")}>
          <Bilingual en={PAPER_DIALOG.mode.en} kn={PAPER_DIALOG.mode.kn} />
        </legend>
        {(["cash", "upi"] as const).map((value) => (
          <label
            key={value}
            htmlFor={`${ids}-${value}`}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-(--radius-control) border border-(--border) px-3 py-2 text-(length:--text-ui) has-checked:border-(--primary-press) has-checked:bg-(--primary-soft)"
          >
            <input
              id={`${ids}-${value}`}
              type="radio"
              name={`${ids}-mode`}
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
              className="size-4 accent-(--primary-press)"
            />
            <Bilingual en={PAPER_DIALOG[value].en} kn={PAPER_DIALOG[value].kn} />
          </label>
        ))}
      </fieldset>
      {mode === "upi" ? (
        <div className={field}>
          <Bilingual as="label" htmlFor={`${ids}-upi-ref`} en={PAPER_DIALOG.upiRef.en} kn={PAPER_DIALOG.upiRef.kn} className={label} />
          <input
            id={`${ids}-upi-ref`}
            inputMode="numeric"
            maxLength={6}
            value={upiRef}
            onChange={(e) => setUpiRef(e.target.value)}
            className={cn(sevaControlClass, "tabular-nums")}
          />
        </div>
      ) : null}

      <div className={field}>
        <Bilingual as="label" htmlFor={`${ids}-note`} en={PAPER_DIALOG.note.en} kn={PAPER_DIALOG.note.kn} className={label} />
        <textarea
          id={`${ids}-note`}
          value={note}
          maxLength={500}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          className={cn(sevaControlClass, "h-auto min-h-20 py-3")}
        />
      </div>

      {error ? (
        <p role="alert" className="text-(length:--text-meta) font-semibold text-(--destructive)">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="seva-secondary" onClick={onClose} disabled={busy}>
          {PAPER_DIALOG.cancel}
        </Button>
        <Button type="button" variant="seva-primary" onClick={() => void confirm()} disabled={!ready} loading={busy}>
          {PAPER_DIALOG.save}
        </Button>
      </div>
    </>
  );
}

export default PaperReceiptDialog;
