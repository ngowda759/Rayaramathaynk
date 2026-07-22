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
      description="Custom daily spiritual quote displayed on the homepage. Leave empty to automatically show scheduled quotes based on the day (Sri Raghavendra Stotra on most days, Guru Vandana on Thursdays, festival quotes during celebrations)."
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
