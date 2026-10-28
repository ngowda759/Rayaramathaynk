"use client";

import { useEffect, useState } from "react";

import { FinanceSettings, defaultFinanceSettings } from "@/types/finance";

/**
 * Public finance settings (donation configuration).
 *
 * Reads `/api/public/settings/financeSettings`. `settings_documents` is deny-all under
 * RLS, so the browser cannot read it directly and the server route serves the stored
 * document with the service-role client. There is no Firestore listener: the defaults
 * are shown until the stored document arrives, and a missing document keeps them.
 */
function normalize(data: Record<string, unknown>): FinanceSettings {
  const billing = data.billing as Record<string, unknown> | undefined;
  return {
    ...defaultFinanceSettings,
    ...data,
    billing: {
      ...defaultFinanceSettings.billing,
      ...(billing || {}),
    },
    billingEnabled: (data.billingEnabled as boolean) ?? false,
  } as FinanceSettings;
}

export function useFinanceSettings() {
  const [settings, setSettings] = useState<FinanceSettings>(defaultFinanceSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const response = await fetch("/api/public/settings/financeSettings");
        if (!response.ok) throw new Error(`Failed to load finance settings (${response.status})`);
        const { data } = (await response.json()) as { data: Record<string, unknown> | null };
        if (!cancelled && data) setSettings(normalize(data));
      } catch (error) {
        console.error("Error loading finance settings:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeSevas = settings.specialSevas
    .filter((s) => s.isActive)
    .sort((a, b) => a.order - b.order);

  return {
    settings,
    loading,
    enabled: settings.enabled,
    upiEnabled: settings.upi.enabled,
    bankTransferEnabled: settings.bankTransfer.enabled,
    upiDetails: settings.upi,
    bankDetails: settings.bankTransfer,
    specialSevas: activeSevas,
  };
}
