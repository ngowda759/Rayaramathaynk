"use client";

import { useState, useEffect } from "react";
import { FinanceSettings, defaultFinanceSettings } from "@/types/finance";
import { settingsRepository } from "@/repositories";

export function useFinanceSettings() {
  const [settings, setSettings] = useState<FinanceSettings>(defaultFinanceSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await settingsRepository.getFinanceSettings();
        setSettings(data);
      } catch (error) {
        console.error("Error loading finance settings:", error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const activeSevas = settings.specialSevas
    .filter(s => s.isActive)
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
