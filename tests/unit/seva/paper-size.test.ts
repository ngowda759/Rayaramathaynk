/**
 * Task A4S-7 - configurable receipt paper size (lib/seva/print/paper.ts). The owner's decision of 2026-10-19 (card
 * `a5`): A5 by default, A6, one-third A4, 80 and 58 mm rolls and a custom size; always portrait, one receipt a sheet.
 */
import {
  CUSTOM_PAPER_LIMITS,
  customPaperProblem,
  fitScale,
  pageSizeCss,
  PAPER_SIZES,
  paperSpec,
  ROLL_TEAR_MARGIN_MM,
  rollPageHeightMm,
  slipLayout,
} from "@/lib/seva/print/paper";
import { act } from "@testing-library/react";

import { sampleReceipt } from "@/components/seva/settings/SlipPreview";
import { printSlips, PRINT_PAGE_STYLE_ID, PRINT_ROOT_ID } from "@/lib/seva/print/printSlips";
import { toSlipModel } from "@/lib/seva/print/slip-model";
import { settingsPatchSchema } from "@/lib/seva/schemas";
import type { SlipSettings } from "@/types/seva";

const TEMPLE = "Sri Raghavendra Swamy Matha";
const PHOTOS = { photoLeft: "https://site.example/l.jpg", photoRight: "https://site.example/r.jpg" };

describe("paper size", () => {
  it("builds the @page size for every preset and a custom size, always portrait", () => {
    const fixed: [string, number, number][] = [
      ["a5", 148, 210],
      ["a6", 105, 148],
      ["third_a4", 99, 210],
    ];
    for (const [size, w, h] of fixed) {
      const spec = paperSpec({ paperSize: size as (typeof PAPER_SIZES)[number] });
      expect({ size, w: spec.widthMm, h: spec.heightMm }).toEqual({ size, w, h });
      expect(pageSizeCss(spec)).toBe(`@page { size: ${w}mm ${h}mm; margin: 0; }`);
    }

    // Rolls: the width is fixed, the height comes from the measured content.
    expect(paperSpec({ paperSize: "roll_80" })).toMatchObject({ widthMm: 80, heightMm: null, roll: true });
    expect(paperSpec({ paperSize: "roll_58" })).toMatchObject({ widthMm: 58, heightMm: null, roll: true });
    expect(pageSizeCss(paperSpec({ paperSize: "roll_80" }), 140)).toBe("@page { size: 80mm 140mm; margin: 0; }");

    const custom = paperSpec({ paperSize: "custom", paperCustomWidthMm: 120, paperCustomHeightMm: 200 });
    expect(pageSizeCss(custom)).toBe("@page { size: 120mm 200mm; margin: 0; }");

    // The default, and the fallback for a bootstrap cached before the setting existed, is A5.
    expect(paperSpec({}).id).toBe("a5");
    expect(paperSpec({ paperSize: null }).id).toBe("a5");

    for (const size of PAPER_SIZES) {
      const spec = paperSpec({ paperSize: size, paperCustomWidthMm: 100, paperCustomHeightMm: 150 });
      const height = spec.heightMm ?? rollPageHeightMm(400);
      expect({ size, portrait: height >= spec.widthMm }).toEqual({ size, portrait: true });
    }
  });

  it("refuses a custom size that would be landscape or out of range", () => {
    expect(CUSTOM_PAPER_LIMITS).toEqual({ minWidthMm: 50, maxWidthMm: 216, minHeightMm: 80, maxHeightMm: 356 });
    expect(customPaperProblem(100, 150)).toBeNull();
    expect(customPaperProblem(100, 100)).toBeNull();
    expect(customPaperProblem(200, 150)).toBe("landscape");
    expect(customPaperProblem(49, 150)).toBe("width");
    expect(customPaperProblem(217, 300)).toBe("width");
    expect(customPaperProblem(60, 79)).toBe("height");
    expect(customPaperProblem(100, 357)).toBe("height");
    expect(customPaperProblem(100.5, 150)).toBe("width");

    // A custom size that cannot print falls back to A5 rather than printing landscape.
    expect(paperSpec({ paperSize: "custom", paperCustomWidthMm: 200, paperCustomHeightMm: 150 }).id).toBe("a5");
    expect(paperSpec({ paperSize: "custom", paperCustomWidthMm: null, paperCustomHeightMm: null }).id).toBe("a5");

    // The settings PATCH refuses them too.
    const ok = (patch: Record<string, unknown>): boolean => settingsPatchSchema.safeParse(patch).success;
    expect(ok({ paperSize: "a6" })).toBe(true);
    expect(ok({ paperSize: "letter" })).toBe(false);
    expect(ok({ paperSize: "custom", paperCustomWidthMm: 100, paperCustomHeightMm: 150 })).toBe(true);
    expect(ok({ paperSize: "custom" })).toBe(false);
    expect(ok({ paperSize: "custom", paperCustomWidthMm: 200, paperCustomHeightMm: 150 })).toBe(false);
    expect(ok({ paperCustomWidthMm: 40, paperCustomHeightMm: 150 })).toBe(false);
    expect(ok({ paperCustomWidthMm: 100, paperCustomHeightMm: 400 })).toBe(false);
  });

  it("fits a roll page height to the content plus the tear margin", () => {
    expect(ROLL_TEAR_MARGIN_MM).toBe(6);
    // 378 CSS px = 100.0 mm (96 px to the inch).
    expect(rollPageHeightMm(378)).toBe(106);
    // Partial millimetres round up, so the last line is never cut.
    expect(rollPageHeightMm(380)).toBe(107);
    // A roll page is never shorter than its width (portrait), even for a tiny slip.
    expect(rollPageHeightMm(10, 80)).toBe(80);

    // A fixed page whose content would overflow shrinks to fit instead of clipping; one that fits stays at 1.
    expect(fitScale(150, 200)).toBe(1);
    expect(fitScale(220, 200)).toBeCloseTo(200 / 220, 5);
  });

  it("A5 uses the larger type and keeps both photos", () => {
    const a5 = slipLayout(paperSpec({ paperSize: "a5" }), { nameEn: TEMPLE, ...PHOTOS });
    expect(a5.variant).toBe("roomy");
    expect(a5.totalPt).toBeGreaterThanOrEqual(16);
    expect(a5.templeNamePt).toBeGreaterThanOrEqual(13);
    expect(a5.devoteeNamePt).toBeGreaterThanOrEqual(13);
    expect(a5.showPhotos).toBe(true);

    for (const size of ["a6", "third_a4"] as const) {
      const layout = slipLayout(paperSpec({ paperSize: size }), { nameEn: TEMPLE, ...PHOTOS });
      expect({ size, variant: layout.variant, total: layout.totalPt, photos: layout.showPhotos }).toEqual({
        size,
        variant: "standard",
        total: 14,
        photos: true,
      });
    }

    // Rolls: the QR stays scannable.
    expect(slipLayout(paperSpec({ paperSize: "roll_80" }), { nameEn: TEMPLE, ...PHOTOS }).qrMm).toBeGreaterThanOrEqual(22);
    expect(slipLayout(paperSpec({ paperSize: "roll_58" }), { nameEn: TEMPLE, ...PHOTOS }).qrMm).toBeGreaterThanOrEqual(18);
  });

  it("58 mm hides the photos only when text would fall below 9 pt", () => {
    const roll58 = paperSpec({ paperSize: "roll_58" });
    const short = slipLayout(roll58, { nameEn: TEMPLE, ...PHOTOS });
    expect(short.showPhotos).toBe(true);
    expect(short.templeNamePt).toBeGreaterThanOrEqual(9);

    const long = slipLayout(roll58, { nameEn: "Sri Mantralayamahasamsthanam Matha", ...PHOTOS });
    expect(long.showPhotos).toBe(false);
    expect(long.templeNamePt).toBeGreaterThanOrEqual(9);

    // At 80 mm the same long name keeps its (small) photos.
    const wide = slipLayout(paperSpec({ paperSize: "roll_80" }), { nameEn: "Sri Mantralayamahasamsthanam Matha", ...PHOTOS });
    expect(wide.showPhotos).toBe(true);
    expect(wide.templeNamePt).toBeGreaterThanOrEqual(9);

    // No photos set: nothing to hide.
    expect(slipLayout(roll58, { nameEn: TEMPLE, photoLeft: null, photoRight: null }).showPhotos).toBe(false);
  });
});

describe("the print job's page size", () => {
  const slip = (over: Partial<SlipSettings>): SlipSettings => ({
    templeNameEn: TEMPLE,
    templeNameKn: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ",
    addressLine1: "Yelahanka New Town",
    addressLine2: "Bengaluru 560064",
    registrationLine: null,
    photoLeftUrl: null,
    photoRightUrl: null,
    footerLine1: "",
    footerLine2: "",
    footerBlessing: "",
    printGotra: true,
    printNakshatra: true,
    printRashi: false,
    ...over,
  });
  const now = new Date("2026-10-19T05:12:00.000Z");
  const model = (over: Partial<SlipSettings> = {}) =>
    toSlipModel(sampleReceipt(23, now), slip(over), { siteUrl: "https://site.example" });
  const pageStyle = (): string | null => document.getElementById(PRINT_PAGE_STYLE_ID)?.textContent ?? null;

  beforeEach(() => {
    const root = document.createElement("div");
    root.id = PRINT_ROOT_ID;
    document.body.appendChild(root);
    jest.spyOn(window, "print").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await act(async () => {
      window.dispatchEvent(new Event("afterprint"));
    });
    document.getElementById(PRINT_ROOT_ID)?.remove();
    jest.restoreAllMocks();
  });

  it("prints on A5 by default and removes the page size after printing", async () => {
    expect(pageStyle()).toBeNull();
    await act(async () => {
      await printSlips([model(), model()]);
    });
    expect(pageStyle()).toContain("@page { size: 148mm 210mm; margin: 0; }");
    const slips = document.querySelectorAll<HTMLElement>(`#${PRINT_ROOT_ID} .slip`);
    expect(slips).toHaveLength(2);
    expect(slips[0].dataset.paper).toBe("a5");
    expect(slips[0].style.getPropertyValue("--slip-w")).toBe("148mm");

    await act(async () => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(pageStyle()).toBeNull();
  });

  it("gives each roll slip its own page, 80 mm wide, in one job", async () => {
    await act(async () => {
      await printSlips([model({ paperSize: "roll_80" }), model({ paperSize: "roll_80" })]);
    });
    const css = pageStyle() ?? "";
    expect(css).toMatch(/@page seva-slip-0 \{ size: 80mm \d+mm; margin: 0; \}/);
    expect(css).toMatch(/@page seva-slip-1 \{ size: 80mm \d+mm; margin: 0; \}/);
    const slips = document.querySelectorAll<HTMLElement>(`#${PRINT_ROOT_ID} .slip`);
    expect(Array.from(slips).map((el) => el.dataset.page)).toEqual(["seva-slip-0", "seva-slip-1"]);
    expect(slips[0].dataset.variant).toBe("roll");
    expect(window.print).toHaveBeenCalledTimes(1);
  });
});
