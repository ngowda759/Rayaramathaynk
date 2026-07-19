"use client";

import FormSection from "@/components/ui/form/FormSection";
import FormTextField from "@/components/ui/form/FormTextField";
import FormTextArea from "@/components/ui/form/FormTextArea";

import {
  HomepageFormData,
} from "./types";

interface DashboardSpecialSectionProps {
  formData: HomepageFormData;
  updateField: <K extends keyof HomepageFormData>(
    key: K,
    value: HomepageFormData[K]
  ) => void;
}

export default function DashboardSpecialSection({
  formData,
  updateField,
}: DashboardSpecialSectionProps) {
  const handleFeaturedEventChange = (field: string, value: string | number | boolean | undefined) => {
    const current = formData.dashboardFeaturedEvent || {
      title: "",
      description: "",
      daysRemaining: undefined,
      isOngoing: false,
    };
    updateField("dashboardFeaturedEvent", {
      ...current,
      [field]: value,
    });
  };

  return (
    <FormSection
      title="Dashboard Today's Special"
      description="Featured event displayed on the Daily Spiritual Dashboard. Leave empty to show upcoming event from events list."
    >
      <div className="space-y-6">
        <FormTextField
          label="Event Title"
          value={formData.dashboardFeaturedEvent?.title || ""}
          placeholder="ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಗಳ ಆರಾಧನಾ ಮಹೋತ್ಸವ"
          onChange={(e) => handleFeaturedEventChange("title", e.target.value)}
        />

        <FormTextArea
          label="Event Description"
          value={formData.dashboardFeaturedEvent?.description || ""}
          placeholder="Join us for the divine Aaradhana Mahotsava of Sri Raghavendra Swamy..."
          onChange={(e) => handleFeaturedEventChange("description", e.target.value)}
          rows={3}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <FormTextField
            label="Days Remaining"
            type="number"
            value={formData.dashboardFeaturedEvent?.daysRemaining?.toString() || ""}
            placeholder="41"
            onChange={(e) => {
              const val = e.target.value;
              const numVal = val ? parseInt(val, 10) : undefined;
              handleFeaturedEventChange("daysRemaining", numVal);
            }}
          />

          <div className="flex items-center gap-3 pt-6">
            <input
              type="checkbox"
              id="isOngoing"
              checked={formData.dashboardFeaturedEvent?.isOngoing || false}
              onChange={(e) => handleFeaturedEventChange("isOngoing", e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="isOngoing" className="text-sm font-medium text-stone-700">
              Event is currently ongoing
            </label>
          </div>
        </div>
      </div>
    </FormSection>
  );
}
