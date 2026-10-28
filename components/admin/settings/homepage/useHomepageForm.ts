"use client";

import { useEffect, useState, useCallback } from "react";

import { useAuth } from "@/hooks/useAuth";
import { HomepageConfig } from "@/types/homepage";

import { DEFAULT_HOMEPAGE_CONFIG } from "./constants";
import {
  HomepageFormData,
  HomepageValidationErrors,
} from "./types";
import {
  hasHomepageValidationErrors,
  validateHomepageForm,
} from "./validation";

export function useHomepageForm() {
  const { user } = useAuth();
  const [formData, setFormData] =
    useState<HomepageFormData>(DEFAULT_HOMEPAGE_CONFIG);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");

  const [errors, setErrors] =
    useState<HomepageValidationErrors>({});

  const loadHomepage = useCallback(async () => {
    try {
       
      setLoading(true);

      const token = await user?.getIdToken();
      const loadResponse = await fetch("/api/admin/homepage", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!loadResponse.ok) {
        throw new Error(`Failed to load homepage settings (${loadResponse.status})`);
      }
      const { data } = (await loadResponse.json()) as { data: HomepageConfig };

       
      setFormData({
        ...DEFAULT_HOMEPAGE_CONFIG,
        ...data,
      });
    } catch (error) {
      console.error("Failed to load homepage.", error);
    } finally {
       
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHomepage();
  }, [loadHomepage]);

  function updateField<K extends keyof HomepageConfig>(
    key: K,
    value: HomepageConfig[K]
  ) {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));

    if (errors[key as keyof HomepageValidationErrors]) {
      setErrors((prev) => ({
        ...prev,
        [key]: "",
      }));
    }
  }

  async function save() {
    const validationErrors =
      validateHomepageForm(formData);

    setErrors(validationErrors);

    if (hasHomepageValidationErrors(validationErrors)) {
      return false;
    }

    try {
      setSaving(true);

      console.log("[HomepageForm] Saving form data:", JSON.stringify(formData, null, 2));
      const token = await user?.getIdToken();
      const saveResponse = await fetch("/api/admin/homepage", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });
      if (!saveResponse.ok) {
        throw new Error(`Failed to save homepage settings (${saveResponse.status})`);
      }
      console.log("[HomepageForm] Save successful");

      // Revalidate the homepage to reflect changes immediately
      try {
        await fetch("/api/revalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paths: ["/"] }),
        });
        console.log("[HomepageForm] Homepage revalidated successfully");
      } catch (revalidateError) {
        console.warn("[HomepageForm] Revalidation failed, changes will appear within 60s:", revalidateError);
      }

      setStatusMessage(
        "Homepage settings saved successfully."
      );

      window.setTimeout(() => {
        setStatusMessage("");
      }, 5000);

      return true;
    } catch (error: any) {
      console.error("[HomepageForm] Save error:", error);

      // Show more detailed error message
      const errorMessage = error?.message || "Unknown error";
      setStatusMessage(
        `Unable to save homepage settings: ${errorMessage}`
      );

      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    formData,
    loading,
    saving,
    errors,
    statusMessage,
    updateField,
    save,
  };
}
