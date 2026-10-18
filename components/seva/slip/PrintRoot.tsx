"use client";

import { useSyncExternalStore, type JSX } from "react";
import { createPortal } from "react-dom";

import { PRINT_ROOT_ID } from "@/lib/seva/print/printSlips";

const subscribe = (): (() => void) => () => undefined;

/**
 * The target printSlips renders into: an empty #seva-print-root placed directly under <body>, so the print
 * stylesheet (styles/seva/print.css) can hide the rest of the page while a job is in it. Hidden on screen; visible
 * only in @media print. Rendered on the client only (no server markup, so no hydration mismatch).
 */
export function PrintRoot(): JSX.Element {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!isClient) return <></>;
  return createPortal(<div id={PRINT_ROOT_ID} className="seva-print-root" />, document.body);
}

export default PrintRoot;
