"use client";

import { useId, useState, type JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { sevaControlClass } from "@/components/ui/input";
import { GAP_DIALOG, GAP_NOTE_MIN } from "@/lib/seva/strings/reports";
import { cn } from "@/lib/utils";
import type { GapResolveRequest } from "@/lib/seva/schemas";
import type { ContinuityGap } from "@/types/seva-reports";

export interface GapResolveDialogProps {
  /** The gap being resolved; the dialog is open while it is set. */
  gap: ContinuityGap | null;
  busy: boolean;
  /** The office's message when the last try failed. */
  error: string | null;
  onConfirm(choice: GapResolveRequest): void;
  onClose(): void;
}

function pad(no: number): string {
  return String(no).padStart(6, "0");
}

/**
 * Resolve an open receipt-number gap (DB §8.5): entered from the paper book or declared lost, with a note of at least
 * three letters. Temple admins and super admins only; the server checks `gap.resolve` again and audits the change.
 */
export function GapResolveDialog({ gap, busy, error, onConfirm, onClose }: GapResolveDialogProps): JSX.Element {
  return (
    <Dialog open={gap !== null} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent variant="seva" showCloseButton={false}>
        {/* Keyed on the gap so each one starts with an empty form. */}
        {gap ? <GapForm key={gap.id} gap={gap} busy={busy} error={error} onConfirm={onConfirm} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function GapForm({
  gap,
  busy,
  error,
  onConfirm,
  onClose,
}: Omit<GapResolveDialogProps, "gap"> & { gap: ContinuityGap }): JSX.Element {
  const ids = useId();
  const [status, setStatus] = useState<GapResolveRequest["status"] | "">("");
  const [note, setNote] = useState("");
  const ready = status !== "" && note.trim().length >= GAP_NOTE_MIN && !busy;

  function confirm(): void {
    if (status === "" || !ready) return;
    onConfirm({ status, note: note.trim() });
  }

  const choices: { value: GapResolveRequest["status"]; label: { en: string; kn: string } }[] = [
    { value: "entered_from_paper", label: GAP_DIALOG.paper },
    { value: "declared_lost", label: GAP_DIALOG.lost },
  ];

  return (
    <>
      <div className="flex flex-col gap-1">
        <DialogTitle variant="seva">{GAP_DIALOG.title(gap.series, pad(gap.fromNo), pad(gap.toNo))}</DialogTitle>
        <DialogDescription className="text-(length:--text-meta) text-(--muted-foreground)">
          <Bilingual en={GAP_DIALOG.description.en} kn={GAP_DIALOG.description.kn} />
        </DialogDescription>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-(length:--text-meta) font-semibold text-(--foreground)">
          <Bilingual en={GAP_DIALOG.what.en} kn={GAP_DIALOG.what.kn} />
        </legend>
        {choices.map((choice) => (
          <label
            key={choice.value}
            htmlFor={`${ids}-${choice.value}`}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-(--radius-control) border border-(--border) px-3 py-2 text-(length:--text-ui) has-checked:border-(--primary-press) has-checked:bg-(--primary-soft)"
          >
            <input
              id={`${ids}-${choice.value}`}
              type="radio"
              name={`${ids}-status`}
              value={choice.value}
              checked={status === choice.value}
              onChange={() => setStatus(choice.value)}
              className="size-4 accent-(--primary-press)"
            />
            <Bilingual en={choice.label.en} kn={choice.label.kn} />
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Bilingual
          as="label"
          htmlFor={`${ids}-note`}
          en={GAP_DIALOG.note.en}
          kn={GAP_DIALOG.note.kn}
          className="text-(length:--text-meta) font-semibold text-(--foreground)"
        />
        <textarea
          id={`${ids}-note`}
          value={note}
          maxLength={500}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
          className={cn(sevaControlClass, "h-auto min-h-24 py-3")}
        />
      </div>

      {error ? (
        <p role="alert" className="text-(length:--text-meta) font-semibold text-(--destructive)">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="seva-secondary" onClick={onClose} disabled={busy}>
          {GAP_DIALOG.cancel}
        </Button>
        <Button type="button" variant="seva-primary" onClick={confirm} disabled={!ready} loading={busy}>
          {GAP_DIALOG.save}
        </Button>
      </div>
    </>
  );
}

export default GapResolveDialog;
