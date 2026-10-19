"use client";

import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { DEFAULT_PAPER_SIZE, PAPER_SIZES } from "@/lib/seva/print/paper";
import { RS } from "@/lib/seva/strings/receipt-settings";
import type { PaperSizeId, SlipSettings } from "@/types/seva";

import { SettingsCard, TextField } from "./ReceiptSettingsFields";

/**
 * Settings - Receipts: the receipt paper (plan A4S-7; owner's decision 2026-10-19). One choice of A5 (default), A6,
 * one-third A4, an 80 or 58 mm roll, or a custom size; the width and height fields show only for the custom size.
 * Always portrait, one receipt a sheet. Controlled like HeaderFooterEditor, so the slip preview follows at once.
 */

export interface PaperSizeFieldProps {
  value: SlipSettings;
  onChange(next: SlipSettings): void;
  readOnly?: boolean;
  /** Field errors by settings key (the page's own check of a custom size). */
  errors?: Partial<Record<keyof SlipSettings, string>>;
}

/** '120' -> 120; '' or anything without a number -> null. Whole millimetres only. */
function mmFromText(text: string): number | null {
  const n = Number.parseInt(text.replace(/\D+/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

export function PaperSizeField({ value, onChange, readOnly = false, errors = {} }: PaperSizeFieldProps): JSX.Element {
  const size: PaperSizeId = value.paperSize ?? DEFAULT_PAPER_SIZE;

  return (
    <SettingsCard title={RS.paper} hint={RS.paperHint} testId="paper-size">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="sr-only">{RS.paper.en}</legend>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {PAPER_SIZES.map((id) => (
            <label key={id} className="inline-flex min-h-11 items-center gap-2" htmlFor={`rs-paper-${id}`}>
              <input
                id={`rs-paper-${id}`}
                type="radio"
                name="rs-paper-size"
                value={id}
                className="h-5 w-5 accent-(--primary-press)"
                checked={size === id}
                disabled={readOnly}
                onChange={() => onChange({ ...value, paperSize: id })}
              />
              <Bilingual en={RS.paperSizes[id].en} kn={RS.paperSizes[id].kn} />
            </label>
          ))}
        </div>
      </fieldset>

      {size === "custom" ? (
        <div className="flex flex-col gap-3" data-testid="paper-custom">
          <Bilingual as="div" en={RS.paperCustomLimits.en} kn={RS.paperCustomLimits.kn} className="meta" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="rs-paperCustomWidthMm"
              label={RS.paperCustomWidth}
              inputMode="numeric"
              maxLength={3}
              value={value.paperCustomWidthMm == null ? "" : String(value.paperCustomWidthMm)}
              onChange={(v) => onChange({ ...value, paperCustomWidthMm: mmFromText(v) })}
              readOnly={readOnly}
              error={errors.paperCustomWidthMm ?? null}
            />
            <TextField
              id="rs-paperCustomHeightMm"
              label={RS.paperCustomHeight}
              inputMode="numeric"
              maxLength={3}
              value={value.paperCustomHeightMm == null ? "" : String(value.paperCustomHeightMm)}
              onChange={(v) => onChange({ ...value, paperCustomHeightMm: mmFromText(v) })}
              readOnly={readOnly}
              error={errors.paperCustomHeightMm ?? null}
            />
          </div>
        </div>
      ) : null}
    </SettingsCard>
  );
}

export default PaperSizeField;
