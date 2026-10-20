import type { JSX } from "react";
import QRCode, { type QRCodeRenderersOptions } from "qrcode";

/** Design Book 10.3: error correction M, a 4-module quiet zone, about 26 mm square on the slip. */
const QR_OPTIONS: QRCodeRenderersOptions = { errorCorrectionLevel: "M", margin: 4 };
const QUIET_ZONE = 4;
const PRINTED_SIZE = "26mm";

/** One SVG path for the dark modules; each horizontal run of dark modules is one rectangle. */
function modulesToPath(size: number, data: Uint8Array, margin: number): string {
  let d = "";
  for (let row = 0; row < size; row += 1) {
    let col = 0;
    while (col < size) {
      if (!data[row * size + col]) {
        col += 1;
        continue;
      }
      let run = 1;
      while (col + run < size && data[row * size + col + run]) run += 1;
      d += `M${col + margin} ${row + margin}h${run}v1h-${run}z`;
      col += run;
    }
  }
  return d;
}

/**
 * The receipt QR as inline SVG, built synchronously so the slip is complete the moment it renders and the print job
 * never waits on a QR image. Pure black on white.
 */
export function SlipQr({ url }: { url: string }): JSX.Element {
  const { modules } = QRCode.create(url, QR_OPTIONS);
  const side = modules.size + QUIET_ZONE * 2;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${side} ${side}`}
      width={PRINTED_SIZE}
      height={PRINTED_SIZE}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Receipt QR code"
      className="slip-qr"
    >
      <rect width={side} height={side} fill="#fff" />
      <path d={modulesToPath(modules.size, modules.data, QUIET_ZONE)} fill="#000" />
    </svg>
  );
}

export default SlipQr;
