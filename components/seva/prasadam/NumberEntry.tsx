"use client";

import type { FormEvent, JSX, Ref } from "react";

import { Button } from "@/components/ui/button";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { PRASADAM } from "@/lib/seva/strings/prasadam";

export interface NumberEntryProps {
  value: string;
  busy?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onChange(value: string): void;
  /** The trimmed text: a receipt number, a short form ('C1 124', '124'), a bare token or the QR URL. */
  onSubmit(value: string): void;
}

/**
 * The receipt-number box (DB §11, §10.3). A USB scanner "types" the QR URL here and presses Enter, so the form submits
 * on Enter; the server reads the URL, the token, the full number or a short form.
 */
export function NumberEntry({ value, busy = false, inputRef, onChange, onSubmit }: NumberEntryProps): JSX.Element {
  function submit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const text = value.trim();
    if (text !== "" && !busy) onSubmit(text);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" role="search" aria-label={PRASADAM.find.en}>
      <div className="flex flex-col gap-1.5">
        <Bilingual
          as="label"
          htmlFor="prasadam-receipt-no"
          en={PRASADAM.numberLabel.en}
          kn={PRASADAM.numberLabel.kn}
          className="text-(length:--text-ui) font-semibold"
        />
        <input
          ref={inputRef}
          id="prasadam-receipt-no"
          name="receiptNo"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-describedby="prasadam-receipt-no-hint"
          placeholder={PRASADAM.numberPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-14 w-full rounded-(--radius-control) border border-(--border-strong) bg-(--input) px-4 font-mono text-(length:--text-body-lg) tabular-nums focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
        />
        <div id="prasadam-receipt-no-hint">
          <Bilingual
            as="div"
            en={PRASADAM.numberHint.en}
            kn={PRASADAM.numberHint.kn}
            className="text-(length:--text-meta) text-(--muted-foreground)"
          />
        </div>
      </div>
      <Button type="submit" variant="seva-primary" disabled={busy || value.trim() === ""} aria-busy={busy || undefined} className="h-14 w-full flex-col gap-0 text-(length:--text-body-lg)">
        <Bilingual en={busy ? PRASADAM.finding.en : PRASADAM.find.en} kn={busy ? PRASADAM.finding.kn : PRASADAM.find.kn} />
      </Button>
    </form>
  );
}

export default NumberEntry;
