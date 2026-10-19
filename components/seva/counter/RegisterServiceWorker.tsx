"use client";

import { useEffect } from "react";

import { SEVA_ROUTES } from "@/lib/seva/routes";

export const SEVA_SW_URL = "/seva-sw.js";
export const SEVA_SW_SCOPE = SEVA_ROUTES.counter;
/**
 * Where the counter's worker was registered before the module moved to /seva (plan A4S-4). A counter PC that
 * installed the app there still has that worker; it is unregistered so it can never serve a stale page.
 */
export const LEGACY_SW_SCOPE = "/admin/receipts/counter";

/** True when a scope is the old counter address or a page below it (not look-alikes such as `counterfeit`). */
function isLegacyScope(scope: string): boolean {
  let path: string;
  try {
    path = new URL(scope).pathname;
  } catch {
    return false;
  }
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  return trimmed === LEGACY_SW_SCOPE || trimmed.startsWith(`${LEGACY_SW_SCOPE}/`);
}

async function dropLegacyWorkers(container: ServiceWorkerContainer): Promise<void> {
  try {
    const registrations = await container.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => isLegacyScope(registration.scope))
        .map((registration) => registration.unregister().catch(() => false)),
    );
  } catch {
    // A browser that cannot list its workers still registers the new one below.
  }
}

/**
 * Registers the counter's service worker (public/seva-sw.js) so the counter pages open without a connection.
 * Production builds only: in development the cache-first rule for `/_next/static` would serve stale dev bundles.
 * First removes the worker left at the old counter address, and leaves every other registration alone.
 * Renders nothing; a browser without service workers simply works online-only.
 */
export default function RegisterServiceWorker(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const container = navigator.serviceWorker;
    void dropLegacyWorkers(container)
      .then(() => container.register(SEVA_SW_URL, { scope: SEVA_SW_SCOPE }))
      .catch(() => {
        // Offline page loading is a convenience; the counter still works online and its outbox still saves offline.
      });
  }, []);
  return null;
}
