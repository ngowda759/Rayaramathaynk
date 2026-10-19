"use client";

import { useEffect } from "react";

import { SEVA_ROUTES } from "@/lib/seva/routes";

export const SEVA_SW_URL = "/seva-sw.js";
/**
 * Seva Entry installs as one app for every role and starts at /seva (owner, 2026-10-20). The worker controls /seva so
 * the installed app still opens on the counter PC when it is offline; it caches only the counter pages.
 */
export const SEVA_SW_SCOPE = SEVA_ROUTES.dashboard;
/**
 * Where the counter's worker was registered before the module moved to /seva (plan A4S-4). A counter PC that
 * installed the app there still has that worker; it is unregistered so it can never serve a stale page.
 */
export const LEGACY_SW_SCOPE = "/admin/receipts/counter";
/** The counter-only scope used before the app started at /seva; the /seva worker replaces it. */
export const COUNTER_ONLY_SW_SCOPE = SEVA_ROUTES.counter;

function scopePath(scope: string): string | null {
  try {
    const path = new URL(scope).pathname;
    return path.endsWith("/") ? path.slice(0, -1) : path;
  } catch {
    return null;
  }
}

/**
 * True for a worker to remove: the old counter address or a page below it (not look-alikes such as `counterfeit`),
 * or exactly the counter-only scope.
 */
function isReplacedScope(scope: string): boolean {
  const path = scopePath(scope);
  if (path === null) return false;
  return path === LEGACY_SW_SCOPE || path.startsWith(`${LEGACY_SW_SCOPE}/`) || path === COUNTER_ONLY_SW_SCOPE;
}

async function dropLegacyWorkers(container: ServiceWorkerContainer): Promise<void> {
  try {
    const registrations = await container.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => isReplacedScope(registration.scope))
        .map((registration) => registration.unregister().catch(() => false)),
    );
  } catch {
    // A browser that cannot list its workers still registers the new one below.
  }
}

/**
 * Registers the counter's service worker (public/seva-sw.js) so the counter pages open without a connection.
 * Production builds only: in development the cache-first rule for `/_next/static` would serve stale dev bundles.
 * First removes the workers it replaces (the old counter address and the counter-only scope), and leaves every other
 * registration alone.
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
