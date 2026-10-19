"use client";

import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import ImageUploader from "@/components/ui/ImageUploader";
import type { Bi } from "@/lib/seva/strings/common";
import { RS } from "@/lib/seva/strings/receipt-settings";
import type { TemplatePatch } from "@/services/seva/settings.service";
import type { SlipSettings } from "@/types/seva";

import { SettingsCard, TextField } from "./ReceiptSettingsFields";

/**
 * Settings - Receipts: the slip header and footer (DB §13.2): temple name in English and Kannada, address lines 1-2,
 * the optional registration line, Photo 1 (left) and Photo 2 (right) through the site's ImageUploader, footer lines
 * 1-2, the blessing, and which devotee details print. The header is also the band on the counter screen (D10).
 * Controlled: every keystroke goes to `onChange`, so the slip preview beside it follows at once.
 */

export interface HeaderFooterEditorProps {
  value: SlipSettings;
  onChange(next: SlipSettings): void;
  readOnly?: boolean;
  /** Field errors by settings key (from the page's own checks). */
  errors?: Partial<Record<keyof SlipSettings, string>>;
}

type TextKey = "templeNameEn" | "templeNameKn" | "addressLine1" | "addressLine2" | "footerLine1" | "footerLine2" | "footerBlessing";
type PhotoKey = "photoLeftUrl" | "photoRightUrl";
type PrintKey = "printGotra" | "printNakshatra" | "printRashi";

const TEXT_FIELDS: { key: TextKey; label: Bi; lang?: string }[] = [
  { key: "templeNameEn", label: RS.templeNameEn },
  { key: "templeNameKn", label: RS.templeNameKn, lang: "kn" },
  { key: "addressLine1", label: RS.addressLine1 },
  { key: "addressLine2", label: RS.addressLine2 },
];

const FOOTER_FIELDS: { key: TextKey; label: Bi; lang?: string }[] = [
  { key: "footerLine1", label: RS.footerLine1 },
  { key: "footerLine2", label: RS.footerLine2 },
  { key: "footerBlessing", label: RS.footerBlessing },
];

const PHOTOS: { key: PhotoKey; label: Bi; side: "left" | "right" }[] = [
  { key: "photoLeftUrl", label: RS.photoLeft, side: "left" },
  { key: "photoRightUrl", label: RS.photoRight, side: "right" },
];

const PRINTS: { key: PrintKey; label: Bi }[] = [
  { key: "printGotra", label: RS.printGotra },
  { key: "printNakshatra", label: RS.printNakshatra },
  { key: "printRashi", label: RS.printRashi },
];

function PhotoField({
  label,
  side,
  url,
  readOnly,
  onChange,
}: {
  label: Bi;
  side: "left" | "right";
  url: string | null;
  readOnly: boolean;
  onChange(url: string | null): void;
}): JSX.Element {
  if (readOnly) {
    return (
      <div className="flex min-w-0 flex-col gap-1.5" data-photo={side}>
        <Bilingual en={label.en} kn={label.kn} className="text-(length:--text-meta) font-semibold" />
        {url ? (
          // A stored Blob URL shown as a small thumbnail; next/image would need every Blob host configured.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label.en} className="h-20 w-20 rounded-(--radius-control) border border-(--border) object-cover" />
        ) : (
          <Bilingual en={RS.noPhoto.en} kn={RS.noPhoto.kn} className="meta" />
        )}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-photo={side} role="group" aria-label={label.en}>
      <Bilingual en={label.en} kn={label.kn} className="text-(length:--text-meta) font-semibold" />
      {/* An empty label keeps the uploader from printing its own English-only one. */}
      <ImageUploader value={url ?? ""} onChange={(next) => onChange(next.trim() === "" ? null : next)} folder="sevas" label="" previewSize="sm" />
    </div>
  );
}

export function HeaderFooterEditor({ value, onChange, readOnly = false, errors = {} }: HeaderFooterEditorProps): JSX.Element {
  const set = <K extends keyof SlipSettings>(key: K, next: SlipSettings[K]) => onChange({ ...value, [key]: next });

  return (
    <SettingsCard title={RS.headerTitle} hint={RS.headerHint} testId="header-footer-editor">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {TEXT_FIELDS.map((f) => (
          <TextField
            key={f.key}
            id={`rs-${f.key}`}
            label={f.label}
            lang={f.lang}
            value={value[f.key]}
            onChange={(v) => set(f.key, v)}
            readOnly={readOnly}
            maxLength={120}
            error={errors[f.key] ?? null}
          />
        ))}
        <TextField
          id="rs-registrationLine"
          className="md:col-span-2"
          label={RS.registrationLine}
          value={value.registrationLine ?? ""}
          onChange={(v) => set("registrationLine", v === "" ? null : v)}
          readOnly={readOnly}
          maxLength={120}
          error={errors.registrationLine ?? null}
        />
        {PHOTOS.map((p) => (
          <PhotoField
            key={p.key}
            label={p.label}
            side={p.side}
            url={value[p.key]}
            readOnly={readOnly}
            onChange={(url) => set(p.key, url)}
          />
        ))}
        {FOOTER_FIELDS.map((f) => (
          <TextField
            key={f.key}
            id={`rs-${f.key}`}
            className="md:col-span-2"
            label={f.label}
            lang={f.lang}
            value={value[f.key]}
            onChange={(v) => set(f.key, v)}
            readOnly={readOnly}
            maxLength={120}
            error={errors[f.key] ?? null}
          />
        ))}
      </div>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 p-0">
          <Bilingual en={RS.devoteeDetails.en} kn={RS.devoteeDetails.kn} className="text-(length:--text-meta) font-semibold" />
        </legend>
        <Bilingual as="div" en={RS.devoteeDetailsHint.en} kn={RS.devoteeDetailsHint.kn} className="meta" />
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {PRINTS.map((p) => (
            <label key={p.key} className="inline-flex min-h-11 items-center gap-2" htmlFor={`rs-${p.key}`}>
              <input
                id={`rs-${p.key}`}
                type="checkbox"
                className="h-5 w-5 accent-(--primary-press)"
                checked={value[p.key]}
                disabled={readOnly}
                onChange={(e) => set(p.key, e.target.checked)}
              />
              <Bilingual en={p.label.en} kn={p.label.kn} />
            </label>
          ))}
        </div>
      </fieldset>
    </SettingsCard>
  );
}

const SLIP_KEYS = [
  "templeNameEn",
  "templeNameKn",
  "addressLine1",
  "addressLine2",
  "registrationLine",
  "photoLeftUrl",
  "photoRightUrl",
  "footerLine1",
  "footerLine2",
  "footerBlessing",
  "printGotra",
  "printNakshatra",
  "printRashi",
] as const satisfies readonly (keyof SlipSettings)[];

/** The fields that differ from the saved copy, trimmed the way the server stores them. */
export function templatePatch(saved: SlipSettings, draft: SlipSettings): TemplatePatch {
  const patch: Record<string, string | boolean | null> = {};
  for (const key of SLIP_KEYS) {
    const raw = draft[key];
    const value = typeof raw === "string" ? (raw.trim() === "" && (key === "registrationLine" || key.endsWith("Url")) ? null : raw.trim()) : raw;
    if (value !== saved[key]) patch[key] = value;
  }
  return patch as TemplatePatch;
}

export default HeaderFooterEditor;
