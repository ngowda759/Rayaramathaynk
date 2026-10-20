"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { openSevaDb } from "@/lib/seva/offline/db";
import { deviceHeader, getDeviceCredentials } from "@/lib/seva/offline/device";
import { RECEIPT } from "@/lib/seva/strings/receipt";
import { counterApi } from "@/services/seva/counter.service";
import { SevaClientError } from "@/services/seva/http";
import { receiptsApi } from "@/services/seva/receipts.service";
import { settingsApi } from "@/services/seva/settings.service";
import type { SlipSettings } from "@/types/seva";
import type { ReceiptDetail } from "@/types/seva-receipts";

/** What the slip needs besides the receipt: the template and the site the QR points to. */
export interface SlipSource {
  settings: SlipSettings;
  siteUrl: string;
}

export type ReceiptPageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      receipt: ReceiptDetail;
      /** null when the slip template could not be read; the page still shows the receipt's details. */
      slip: SlipSource | null;
      /** This PC's `x-seva-device` value, or null when it is not a registered counter. */
      device: string | null;
    };

/** This PC's device header, or null when it is not registered (or IndexedDB is unavailable). */
async function readDeviceHeader(): Promise<string | null> {
  try {
    const db = await openSevaDb();
    try {
      const credentials = await getDeviceCredentials(db);
      return credentials ? deviceHeader(credentials) : null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/**
 * The slip template: from the counter bootstrap on a registered PC (any counter person may read it there, and it
 * carries the site URL), else from Settings - Receipts (temple admins). null when neither answers.
 */
async function readSlip(token: () => Promise<string>, device: string | null): Promise<SlipSource | null> {
  if (device) {
    try {
      const boot = await counterApi(token, () => device).bootstrap();
      return { settings: boot.slip, siteUrl: boot.siteUrl };
    } catch {
      // Fall through to the settings route.
    }
  }
  try {
    const settings = await settingsApi(token).getTemplate();
    return { settings, siteUrl: window.location.origin };
  } catch {
    return null;
  }
}

/**
 * Loads one receipt for the detail and print pages (`receiptsApi.get`, A3-2) with the device header when this PC is a
 * registered counter, plus the slip template. Errors carry the API's own message.
 */
export function useReceiptPage(receiptId: string | undefined): {
  state: ReceiptPageState;
  token: () => Promise<string>;
  reload(): void;
} {
  const { user } = useAuth();
  const [state, setState] = useState<ReceiptPageState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  const token = useCallback(async (): Promise<string> => {
    if (!user) throw new SevaClientError("unauthenticated", 401, RECEIPT.loadFailed.en);
    return user.getIdToken();
  }, [user]);

  useEffect(() => {
    if (!user || !receiptId) return;
    let cancelled = false;
    void (async () => {
      const device = await readDeviceHeader();
      try {
        const receipt = await receiptsApi(token, () => device).get(receiptId);
        const slip = await readSlip(token, device);
        if (!cancelled) setState({ kind: "ready", receipt, slip, device });
      } catch (err) {
        if (cancelled) return;
        setState({ kind: "error", message: err instanceof SevaClientError ? err.message : RECEIPT.loadFailed.en });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, receiptId, token, attempt]);

  const reload = useCallback((): void => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, token, reload };
}
