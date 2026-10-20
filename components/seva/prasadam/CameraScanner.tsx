"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { Camera } from "lucide-react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { CameraError, startScanner, type CameraErrorCode } from "@/lib/seva/prasadam/camera";
import { PRASADAM } from "@/lib/seva/strings/prasadam";
import type { Bi } from "@/lib/seva/strings/common";

export interface CameraScannerProps {
  /** Shows "Ready for the next slip" instead of the first-use hint (after a slip was marked given). */
  readyForNext?: boolean;
  /** Each QR text read; repeats of the same code arrive on later frames and are the caller's to ignore. */
  onCode(text: string): void;
  /** Called once the camera is running and reading frames (the slip in front of it is seen again from now on). */
  onRunning?(): void;
}

type CameraStatus = "starting" | "running" | CameraErrorCode;

const ERROR_TEXT: Record<CameraErrorCode, Bi> = {
  unsupported: PRASADAM.cameraUnsupported,
  denied: PRASADAM.cameraDenied,
  no_camera: PRASADAM.cameraMissing,
  failed: PRASADAM.cameraFailed,
};

const CORNER = "pointer-events-none absolute size-11 border-4 border-(--primary-press)";

/**
 * The camera view-finder of the prasadam counter. The camera runs while this is shown and stops when it unmounts
 * (a result on screen, the typed mode, leaving the page). Needs https; otherwise it says to type the number.
 */
export function CameraScanner({ readyForNext = false, onCode, onRunning }: CameraScannerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onCodeRef = useRef(onCode);
  const onRunningRef = useRef(onRunning);
  const [status, setStatus] = useState<CameraStatus>("starting");

  useEffect(() => {
    onCodeRef.current = onCode;
    onRunningRef.current = onRunning;
  }, [onCode, onRunning]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    let cancelled = false;
    let stop: (() => void) | null = null;
    startScanner(video, (text) => onCodeRef.current(text))
      .then((stopScanner) => {
        if (cancelled) stopScanner();
        else {
          stop = stopScanner;
          setStatus("running");
          onRunningRef.current?.();
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus(error instanceof CameraError ? error.code : "failed");
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const failed = status !== "starting" && status !== "running";
  const hint: Bi = status === "starting" ? PRASADAM.cameraStarting : readyForNext ? PRASADAM.cameraReady : PRASADAM.cameraHold;

  return (
    <div className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={readyForNext ? PRASADAM.cameraReady.en : PRASADAM.cameraHold.en}
        className="relative aspect-square w-full overflow-hidden rounded-(--radius-surface) bg-(--muted)"
      >
        <video ref={videoRef} muted playsInline aria-hidden="true" className={`size-full object-cover ${status === "running" ? "" : "invisible"}`} />
        <span className={`${CORNER} top-5 left-5 rounded-tl-xl border-r-0 border-b-0`} />
        <span className={`${CORNER} top-5 right-5 rounded-tr-xl border-b-0 border-l-0`} />
        <span className={`${CORNER} bottom-5 left-5 rounded-bl-xl border-t-0 border-r-0`} />
        <span className={`${CORNER} right-5 bottom-5 rounded-br-xl border-t-0 border-l-0`} />
        {status !== "running" && !failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-8 text-center text-(--muted-foreground)">
            <Camera aria-hidden="true" className="size-10" />
            <Bilingual as="div" en={hint.en} kn={hint.kn} />
          </div>
        ) : null}
        {status === "running" ? (
          <div className="absolute inset-x-0 bottom-0 bg-[oklch(0.2_0.02_60/0.55)] px-4 py-2 text-center text-(length:--text-meta) font-semibold text-[oklch(0.99_0_0)]">
            {hint.en}
          </div>
        ) : null}
        {failed ? (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <Camera aria-hidden="true" className="size-10 text-(--muted-foreground)" />
            <Bilingual as="div" en={ERROR_TEXT[status].en} kn={ERROR_TEXT[status].kn} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CameraScanner;
