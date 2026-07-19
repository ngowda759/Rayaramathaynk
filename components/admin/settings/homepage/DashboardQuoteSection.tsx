"use client";

import FormSection from "@/components/ui/form/FormSection";
import FormTextField from "@/components/ui/form/FormTextField";
import FormTextArea from "@/components/ui/form/FormTextArea";

import {
  HomepageFormData,
} from "./types";

interface DashboardQuoteSectionProps {
  formData: HomepageFormData;
  updateField: <K extends keyof HomepageFormData>(
    key: K,
    value: HomepageFormData[K]
  ) => void;
}

export default function DashboardQuoteSection({
  formData,
  updateField,
}: DashboardQuoteSectionProps) {
  const handleQuoteChange = (field: string, value: string) => {
    const current = formData.dailyQuote || {
      text: "",
      source: "",
    };
    updateField("dailyQuote", {
      ...current,
      [field]: value,
    });
  };

  return (
    <FormSection
      title="Dashboard Daily Inspiration"
      description="Daily spiritual quote displayed on the Daily Spiritual Dashboard. Leave empty to show default rotating quotes."
    >
      <div className="space-y-6">
        <FormTextArea
          label="Quote Text"
          value={formData.dailyQuote?.text || ""}
          placeholder="ಓಂ ನಮೋ ಭಗವತೇ ವಾಸುದೇವಾಯ | ಓಂ ನಮೋ ಶ್ರೀ ರಾಘವೇಂದ್ರಾಯ"
          onChange={(e) => handleQuoteChange("text", e.target.value)}
          rows={3}
        />

        <FormTextField
          label="Quote Source"
          value={formData.dailyQuote?.source || ""}
          placeholder="Daily Prayer"
          onChange={(e) => handleQuoteChange("source", e.target.value)}
        />
      </div>
    </FormSection>
  );
}
