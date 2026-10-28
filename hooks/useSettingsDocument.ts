"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import type { SettingsDocumentKey } from "@/services/settings-document.service";

/**
 * Load and save a website settings document.
 *
 * The public site reads `/api/public/settings/<key>`; an admin page reads and writes
 * `/api/admin/settings/<key>` with the signed-in admin's Firebase ID token, the same
 * mechanism `useHomepageForm` and the guru-parampara form use. `settings_documents` is
 * deny-all under RLS, so the browser can never read it directly. There is no Firestore
 * listener.
 *
 * The caller's built-in defaults are shown until the stored document arrives, so a
 * first paint is never blank and a document that has not been created yet keeps the
 * defaults rather than clearing them.
 */
export function useSettingsDocument<T extends object>(
  key: SettingsDocumentKey,
  defaults: T,
  options: { admin?: boolean } = {}
) {
  const { user } = useAuth();
  const [data, setData] = useState<T>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = options.admin ?? false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const path = isAdmin
        ? `/api/admin/settings/${key}`
        : `/api/public/settings/${key}`;
      const token = isAdmin ? await user?.getIdToken() : undefined;
      const response = await fetch(path, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error(`Failed to load settings (${response.status})`);
      }
      const { data: stored } = (await response.json()) as { data: T | null };
      if (stored) setData({ ...defaults, ...stored });
    } catch (error) {
      console.error(`Failed to load ${key} settings:`, error);
    } finally {
      setLoading(false);
    }
  }, [key, isAdmin, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const save = useCallback(
    async (next: T): Promise<boolean> => {
      if (!isAdmin) throw new Error("Saving requires the admin client");
      setSaving(true);
      try {
        const token = await user?.getIdToken();
        const response = await fetch(`/api/admin/settings/${key}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(next),
        });
        if (!response.ok) {
          throw new Error(`Failed to save settings (${response.status})`);
        }
        return true;
      } finally {
        setSaving(false);
      }
    },
    [key, isAdmin, user]
  );

  return { data, setData, loading, saving, save, reload: load };
}
