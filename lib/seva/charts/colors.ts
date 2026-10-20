/**
 * Chart colours for the seva dashboard (DESIGN-BOOK 12.5, R5 s4).
 * The palette lives in `styles/seva/tokens.css` as oklch `--chart-1..5`; ECharts cannot parse oklch or var(),
 * so each token is painted on a 1x1 canvas and read back as 'rgb(r, g, b)'.
 */

export const CHART_TOKEN_COUNT = 5;

/** Used only when a token is missing or the browser has no 2D canvas (close to the light-theme tokens). */
export const FALLBACK_CHART_COLORS: readonly string[] = [
  "rgb(219, 163, 47)",
  "rgb(176, 98, 52)",
  "rgb(40, 125, 83)",
  "rgb(70, 112, 164)",
  "rgb(146, 41, 52)",
];

/** The previous period is always a neutral, dashed grey (R5 s5). */
export const CHART_PREV_COLOR = "rgb(150, 150, 150)";

/** Reads `--chart-1..5` from `el` and returns them as rgb strings ECharts understands. */
export function readChartColors(el: HTMLElement): string[] {
  const style = window.getComputedStyle(el);
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const colors: string[] = [];
  for (let i = 1; i <= CHART_TOKEN_COUNT; i += 1) {
    const fallback = FALLBACK_CHART_COLORS[i - 1];
    const token = style.getPropertyValue(`--chart-${i}`).trim();
    if (!token || !ctx) {
      colors.push(fallback);
      continue;
    }
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = fallback;
    ctx.fillStyle = token;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    colors.push(`rgb(${r}, ${g}, ${b})`);
  }
  return colors;
}
