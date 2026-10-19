"use client";

import { useEffect } from "react";

export const SEVA_SW_URL = "/seva-sw.js";
export const SEVA_SW_SCOPE = "/admin/receipts/counter";

/**
 * Registers the counter's service worker (public/seva-sw.js) so the counter pages open without a connection.
 * Production builds only: in development the cache-first rule for `/_next/static` would serve stale dev bundles.
 * Renders nothing; a browser without service workers simply works online-only.
 */
export default function RegisterServiceWorker(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(SEVA_SW_URL, { scope: SEVA_SW_SCOPE }).catch(() => {
      // Offline page loading is a convenience; the counter still works online and its outbox still saves offline.
    });
  }, []);
  return null;
}
