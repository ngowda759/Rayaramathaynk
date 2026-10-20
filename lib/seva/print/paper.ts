/**
 * The receipt paper (plan A4S-7; owner's decision 2026-10-19, card `a5`): A5 by default, A6, one-third A4, 80 and
 * 58 mm thermal rolls, or a custom size. Always portrait, one receipt a sheet. Pure: no DOM, no React.
 *
 * - `paperSpec` turns the stored setting into page dimensions (a bad or missing setting prints on A5).
 * - `slipLayout` picks the type sizes, the QR size and whether the header photos print for that paper.
 * - `pageSizeCss` / `pageRule` build the `@page` rule the print job puts on the page at print time.
 * - `rollPageHeightMm` fits a roll page to the measured slip plus the tear margin; `fitScale` shrinks a slip whose
 *   content would overflow a fixed page, so no line is ever clipped.
 */
import type { PaperSizeId, SlipSettings } from "@/types/seva";

export const PAPER_SIZES = ["a5", "a6", "third_a4", "roll_80", "roll_58", "custom"] as const satisfies readonly PaperSizeId[];

export const DEFAULT_PAPER_SIZE = "a5" satisfies PaperSizeId;

/** Custom sizes, in whole millimetres. The height must also be at least the width (portrait). */
export const CUSTOM_PAPER_LIMITS = { minWidthMm: 50, maxWidthMm: 216, minHeightMm: 80, maxHeightMm: 356 } as const;

/** Paper left under a roll slip so the tear never cuts the last line. */
export const ROLL_TEAR_MARGIN_MM = 6;

/** The smallest text a slip may print, in points. */
export const MIN_TEXT_PT = 9;

const MM_PER_PT = 25.4 / 72;
const MM_PER_PX = 25.4 / 96;
/** Average advance of a bold Latin letter, in em (Inter bold); used to see whether the temple name fits. */
const BOLD_CHAR_EM = 0.55;
/** A fixed page leaves this much below the slip so rounding never pushes it onto a second sheet. */
const PAGE_SLACK_MM = 1;
/** The least a too-long slip is shrunk to; below that it would be unreadable. */
const MIN_FIT_SCALE = 0.7;

/** The paper part of the slip settings. Every field may be missing in a bootstrap cached before the setting existed. */
export type PaperSetting = Partial<Pick<SlipSettings, "paperSize" | "paperCustomWidthMm" | "paperCustomHeightMm">> & {
  paperSize?: PaperSizeId | null;
};

export interface PaperSpec {
  id: PaperSizeId;
  widthMm: number;
  /** null for a roll: the height is fitted to the content at print time. */
  heightMm: number | null;
  roll: boolean;
  /** White space inside the sheet on every side (the @page margin is 0). */
  padMm: number;
}

interface Preset {
  widthMm: number;
  heightMm: number | null;
  padMm: number;
}

const PRESETS: Record<Exclude<PaperSizeId, "custom">, Preset> = {
  a5: { widthMm: 148, heightMm: 210, padMm: 7 },
  a6: { widthMm: 105, heightMm: 148, padMm: 5 },
  third_a4: { widthMm: 99, heightMm: 210, padMm: 5 },
  // Thermal printers print about 72 mm of an 80 mm roll and 48 mm of a 58 mm roll.
  roll_80: { widthMm: 80, heightMm: null, padMm: 4 },
  roll_58: { widthMm: 58, heightMm: null, padMm: 5 },
};

const CUSTOM_PAD_MM = 5;

export function isPaperSize(value: unknown): value is PaperSizeId {
  return typeof value === "string" && (PAPER_SIZES as readonly string[]).includes(value);
}

/** Why a custom size cannot print, or null when it can. */
export function customPaperProblem(widthMm: number, heightMm: number): "width" | "height" | "landscape" | null {
  const L = CUSTOM_PAPER_LIMITS;
  if (!Number.isInteger(widthMm) || widthMm < L.minWidthMm || widthMm > L.maxWidthMm) return "width";
  if (!Number.isInteger(heightMm) || heightMm < L.minHeightMm || heightMm > L.maxHeightMm) return "height";
  if (heightMm < widthMm) return "landscape";
  return null;
}

function presetSpec(id: Exclude<PaperSizeId, "custom">): PaperSpec {
  const p = PRESETS[id];
  return { id, widthMm: p.widthMm, heightMm: p.heightMm, roll: p.heightMm === null, padMm: p.padMm };
}

/** The page for a paper setting. Missing, unknown or unprintable settings print on A5. */
export function paperSpec(setting: PaperSetting): PaperSpec {
  const size = isPaperSize(setting.paperSize) ? setting.paperSize : DEFAULT_PAPER_SIZE;
  if (size !== "custom") return presetSpec(size);
  const w = setting.paperCustomWidthMm;
  const h = setting.paperCustomHeightMm;
  if (typeof w !== "number" || typeof h !== "number" || customPaperProblem(w, h) !== null) {
    return presetSpec(DEFAULT_PAPER_SIZE);
  }
  return { id: "custom", widthMm: w, heightMm: h, roll: false, padMm: CUSTOM_PAD_MM };
}

/** The slip box: the sheet less a little slack at the foot (fixed pages), or the roll width with a fitted height. */
export function slipBox(spec: PaperSpec): { widthMm: number; heightMm: number | null } {
  return { widthMm: spec.widthMm, heightMm: spec.heightMm === null ? null : spec.heightMm - PAGE_SLACK_MM };
}

/**
 * One `@page` rule, optionally named (`@page seva-slip-0 { ... }`). Margin 0 for a slip, which carries its own white
 * space; the day-close summary, which flows over several sheets, sets the margin so every sheet has it.
 */
export function pageRule(widthMm: number, heightMm: number, opts: { name?: string; marginMm?: number } = {}): string {
  const margin = opts.marginMm ? `${opts.marginMm}mm` : "0";
  return `@page${opts.name ? ` ${opts.name}` : ""} { size: ${widthMm}mm ${heightMm}mm; margin: ${margin}; }`;
}

/** The `@page` rule for this paper. A roll needs the fitted height (`rollPageHeightMm`); without it, a square page. */
export function pageSizeCss(spec: PaperSpec, rollHeightMm?: number): string {
  return pageRule(spec.widthMm, spec.heightMm ?? rollHeightMm ?? spec.widthMm);
}

/** A roll page: the measured slip (CSS px) plus the tear margin, rounded up to whole mm, never shorter than wide. */
export function rollPageHeightMm(contentPx: number, widthMm = 0): number {
  const contentMm = Math.round(contentPx * MM_PER_PX * 10) / 10;
  return Math.max(widthMm, Math.ceil(contentMm + ROLL_TEAR_MARGIN_MM));
}

/** CSS px to mm (96 px to the inch). */
export function pxToMm(px: number): number {
  return px * MM_PER_PX;
}

/** How much a fixed-page slip must shrink so its content fits the box: 1 when it already fits. */
export function fitScale(contentMm: number, boxMm: number): number {
  if (contentMm <= boxMm || contentMm <= 0) return 1;
  return Math.max(MIN_FIT_SCALE, boxMm / contentMm);
}

export type SlipVariant = "roomy" | "standard" | "roll";

export interface SlipLayout {
  variant: SlipVariant;
  /** Body text. Kannada prints at the same size, never smaller. */
  bodyPt: number;
  templeNamePt: number;
  devoteeNamePt: number;
  sevaDatePt: number;
  totalPt: number;
  qrMm: number;
  photoMm: number;
  /** False when no photo is set, or on a narrow roll where the photos would squeeze the name below 9 pt. */
  showPhotos: boolean;
}

interface VariantSizes {
  bodyPt: number;
  templeNamePt: number;
  devoteeNamePt: number;
  sevaDatePt: number;
  totalPt: number;
  qrMm: number;
  photoMm: number;
  photoGapMm: number;
}

const ROOMY: VariantSizes = { bodyPt: 11, templeNamePt: 14, devoteeNamePt: 13, sevaDatePt: 20, totalPt: 16, qrMm: 30, photoMm: 22, photoGapMm: 3 };
/** Today's slip (one-third A4): body 10 pt, name 11 pt, seva date 18 pt, total 14 pt, QR 26 mm, photos 15 mm. */
const STANDARD: VariantSizes = { bodyPt: 10, templeNamePt: 11, devoteeNamePt: 10, sevaDatePt: 18, totalPt: 14, qrMm: 26, photoMm: 15, photoGapMm: 2 };
const ROLL_80: VariantSizes = { bodyPt: 10, templeNamePt: 11, devoteeNamePt: 10, sevaDatePt: 16, totalPt: 14, qrMm: 24, photoMm: 12, photoGapMm: 2 };
const ROLL_58: VariantSizes = { bodyPt: 10, templeNamePt: 10, devoteeNamePt: 10, sevaDatePt: 14, totalPt: 13, qrMm: 20, photoMm: 10, photoGapMm: 1.5 };

function sizesFor(spec: PaperSpec): { variant: SlipVariant; sizes: VariantSizes } {
  if (spec.id === "roll_80") return { variant: "roll", sizes: ROLL_80 };
  if (spec.id === "roll_58") return { variant: "roll", sizes: ROLL_58 };
  if (spec.id === "a5") return { variant: "roomy", sizes: ROOMY };
  if (spec.id === "custom" && spec.widthMm >= 140 && (spec.heightMm ?? 0) >= 200) return { variant: "roomy", sizes: ROOMY };
  return { variant: "standard", sizes: STANDARD };
}

/** The largest size, in pt, at which the longest word of `text` fits `widthMm` on one line. */
function fittingPt(text: string, widthMm: number): number {
  const longest = text.split(/\s+/).reduce((n, word) => Math.max(n, word.length), 0);
  if (longest === 0) return Number.POSITIVE_INFINITY;
  return widthMm / (longest * BOLD_CHAR_EM * MM_PER_PT);
}

/** The type and header for one slip on this paper. */
export function slipLayout(
  spec: PaperSpec,
  header: { nameEn: string; photoLeft: string | null; photoRight: string | null },
): SlipLayout {
  const { variant, sizes } = sizesFor(spec);
  const hasPhotos = header.photoLeft !== null || header.photoRight !== null;
  let showPhotos = hasPhotos;
  let templeNamePt = sizes.templeNamePt;

  if (variant === "roll") {
    // The header stacks into one row of small photos either side of the name; on a narrow roll the photos give way
    // when they would push the temple name below 9 pt.
    const textWidth = spec.widthMm - spec.padMm * 2;
    const beside = textWidth - 2 * (sizes.photoMm + sizes.photoGapMm);
    templeNamePt = Math.min(sizes.templeNamePt, fittingPt(header.nameEn, showPhotos ? beside : textWidth));
    if (showPhotos && templeNamePt < MIN_TEXT_PT) {
      showPhotos = false;
      templeNamePt = Math.min(sizes.templeNamePt, fittingPt(header.nameEn, textWidth));
    }
    templeNamePt = Math.max(MIN_TEXT_PT, Math.floor(templeNamePt * 2) / 2);
  }

  return {
    variant,
    bodyPt: sizes.bodyPt,
    templeNamePt,
    devoteeNamePt: sizes.devoteeNamePt,
    sevaDatePt: sizes.sevaDatePt,
    totalPt: sizes.totalPt,
    qrMm: sizes.qrMm,
    photoMm: sizes.photoMm,
    showPhotos,
  };
}

/** Plain words for a paper size, for the settings page and the preview caption: 'A5 - 148 x 210 mm'. */
export function paperLabel(spec: PaperSpec): string {
  const names: Record<PaperSizeId, string> = {
    a5: "A5",
    a6: "A6",
    third_a4: "One-third A4",
    roll_80: "80 mm roll",
    roll_58: "58 mm roll",
    custom: "Custom",
  };
  return spec.heightMm === null
    ? `${names[spec.id]} - ${spec.widthMm} mm wide`
    : `${names[spec.id]} - ${spec.widthMm} x ${spec.heightMm} mm`;
}
