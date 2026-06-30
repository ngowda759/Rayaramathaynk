"use client";

import { useEffect, useState } from "react";

import { homepageService } from "@/services/homepage.service";
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
  const [formData, setFormData] =
    useState<HomepageFormData>(DEFAULT_HOMEPAGE_CONFIG);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");

  const [errors, setErrors] =
    useState<HomepageValidationErrors>({});

  useEffect(() => {
    loadHomepage();
  }, []);

  async function loadHomepage() {
    try {
      setLoading(true);

      const data = await homepageService.getHomepage();

      setFormData({
        ...DEFAULT_HOMEPAGE_CONFIG,
        ...data,
      });
    } catch (error) {
      console.error("Failed to load homepage.", error);
    } finally {
      setLoading(false);
    }
  }

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

      await homepageService.saveHomepage(formData);

      setStatusMessage(
        "Homepage settings saved successfully."
      );

      window.setTimeout(() => {
        setStatusMessage("");
      }, 5000);

      return true;
    } catch (error) {
      console.error(error);

      setStatusMessage(
        "Unable to save homepage settings."
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
