"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FinanceSettings, defaultFinanceSettings } from "@/types/finance";

const SETTINGS_DOC = "financeSettings";
const SETTINGS_COLLECTION = "settings";

export function useFinanceSettings() {
  const [settings, setSettings] = useState<FinanceSettings>(defaultFinanceSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Ensure billing fields exist even if not in existing data
          setSettings({
            ...defaultFinanceSettings,
            ...data,
            billing: data.billingEnabled !== undefined || data.billing
              ? {
                  invoicePrefix: data.billing?.invoicePrefix || defaultFinanceSettings.billing.invoicePrefix,
                  invoiceNumber: data.billing?.invoiceNumber || defaultFinanceSettings.billing.invoiceNumber,
                  defaultDueDays: data.billing?.defaultDueDays || defaultFinanceSettings.billing.defaultDueDays,
                  taxRate: data.billing?.taxRate ?? defaultFinanceSettings.billing.taxRate,
                  currency: data.billing?.currency || defaultFinanceSettings.billing.currency,
                  companyName: data.billing?.companyName || defaultFinanceSettings.billing.companyName,
                  companyAddress: data.billing?.companyAddress || defaultFinanceSettings.billing.companyAddress,
                  companyPhone: data.billing?.companyPhone || defaultFinanceSettings.billing.companyPhone,
                  companyEmail: data.billing?.companyEmail || defaultFinanceSettings.billing.companyEmail,
                  companyGstin: data.billing?.companyGstin || defaultFinanceSettings.billing.companyGstin,
                  notes: data.billing?.notes || defaultFinanceSettings.billing.notes,
                }
              : defaultFinanceSettings.billing,
            billingEnabled: data.billingEnabled ?? false,
          });
        }
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
