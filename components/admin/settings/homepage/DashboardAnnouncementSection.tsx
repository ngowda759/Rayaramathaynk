"use client";

import FormSection from "@/components/ui/form/FormSection";
import FormTextArea from "@/components/ui/form/FormTextArea";

import {
  HomepageFormData,
} from "./types";

interface DashboardAnnouncementSectionProps {
  formData: HomepageFormData;
  updateField: <K extends keyof HomepageFormData>(
    key: K,
    value: HomepageFormData[K]
  ) => void;
}

export default function DashboardAnnouncementSection({
  formData,
  updateField,
}: DashboardAnnouncementSectionProps) {
  return (
    <FormSection
      title="Dashboard Announcement"
      description="Featured announcement banner displayed at the top of the Daily Spiritual Dashboard section."
    >
      <FormTextArea
        label="Announcement"
        value={formData.announcement2 || ""}
        placeholder="e.g., Raghavendra Swamygala Aaradhane on January 15th, 2026"
        onChange={(e) => updateField("announcement2", e.target.value)}
        rows={3}
      />
    </FormSection>
  );
}
