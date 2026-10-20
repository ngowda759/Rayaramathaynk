/**
 * QR scanning for the prasadam counter (DB §11, plan Task A4-5). Uses the browser's `BarcodeDetector` (`qr_code`)
 * where it exists, otherwise decodes canvas frames with `jsqr` (loaded only then). Frames are read every 200 ms.
 * The camera needs a secure page (https or localhost); without it `navigator.mediaDevices` is missing and the scanner
 * fails with `unsupported`, so the page offers the typed receipt number instead.
 */

export const SCAN_INTERVAL_MS = 200;

/** jsqr reads a frame no wider than this; a phone camera frame is scaled down to keep each read short. */
const MAX_DECODE_WIDTH = 640;

export type CameraErrorCode = "unsupported" | "denied" | "no_camera" | "failed";

export class CameraError extends Error {
  readonly code: CameraErrorCode;

  constructor(code: CameraErrorCode, message: string) {
    super(message);
    this.name = "CameraError";
    this.code = code;
  }
}

interface DetectedCode {
  rawValue: string;
}

interface QrDetector {
  detect(source: HTMLVideoElement): Promise<DetectedCode[]>;
}

interface QrDetectorClass {
  new (options: { formats: string[] }): QrDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

type ReadFrame = (video: HTMLVideoElement) => Promise<string | null>;

function cameraErrorOf(error: unknown): CameraError {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return new CameraError("denied", "The camera is not allowed.");
  if (name === "NotFoundError" || name === "OverconstrainedError") return new CameraError("no_camera", "No camera was found.");
  return new CameraError("failed", "The camera could not start.");
}

async function nativeReader(): Promise<ReadFrame | null> {
  const Detector = (globalThis as { BarcodeDetector?: QrDetectorClass }).BarcodeDetector;
  if (typeof Detector !== "function") return null;
  try {
    if (Detector.getSupportedFormats) {
      const formats = await Detector.getSupportedFormats();
      if (!formats.includes("qr_code")) return null;
    }
    const detector = new Detector({ formats: ["qr_code"] });
    return async (video) => {
      const codes = await detector.detect(video);
      const found = codes.find((c) => typeof c.rawValue === "string" && c.rawValue.trim() !== "");
      return found ? found.rawValue.trim() : null;
    };
  } catch {
    return null;
  }
}

async function canvasReader(): Promise<ReadFrame> {
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  return async (video) => {
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) return null;
    const scale = Math.min(1, MAX_DECODE_WIDTH / sourceWidth);
    const width = Math.round(sourceWidth * scale);
    const height = Math.round(sourceHeight * scale);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
    return code && code.data.trim() !== "" ? code.data.trim() : null;
  };
}

/**
 * Starts the back camera on `video` and calls `onCode` with the text of each QR code it reads (the same code is
 * reported again on later frames; the caller ignores repeats). Resolves with a function that stops the camera.
 * Rejects with a CameraError: `unsupported` (no camera API - not https), `denied`, `no_camera` or `failed`.
 */
export async function startScanner(video: HTMLVideoElement, onCode: (text: string) => void): Promise<() => void> {
  const media = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  if (!media || typeof media.getUserMedia !== "function") {
    throw new CameraError("unsupported", "This browser cannot use the camera on this page (https is needed).");
  }

  let stream: MediaStream;
  try {
    stream = await media.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
  } catch (error) {
    throw cameraErrorOf(error);
  }

  const stopTracks = (): void => {
    stream.getTracks().forEach((track) => track.stop());
  };

  let read: ReadFrame;
  try {
    video.muted = true;
    video.setAttribute("playsinline", "true");
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // Autoplay can refuse until the stream has data; frames are read once readyState allows it.
    }
    read = (await nativeReader()) ?? (await canvasReader());
  } catch {
    stopTracks();
    throw new CameraError("failed", "The camera could not start.");
  }

  let stopped = false;
  let reading = false;
  const tick = async (): Promise<void> => {
    if (stopped || reading || video.readyState < 2) return;
    reading = true;
    try {
      const text = await read(video);
      if (text && !stopped) onCode(text);
    } catch {
      // A frame that cannot be read is skipped; the next one is tried.
    } finally {
      reading = false;
    }
  };
  const timer = setInterval(() => {
    void tick();
  }, SCAN_INTERVAL_MS);

  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    stopTracks();
    video.srcObject = null;
  };
}
