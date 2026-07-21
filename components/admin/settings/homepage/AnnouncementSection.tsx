"use client";

import FormSection from "@/components/ui/form/FormSection";
import FormTextArea from "@/components/ui/form/FormTextArea";

import {
  HomepageFormData,
  HomepageValidationErrors,
} from "./types";

interface AnnouncementSectionProps {
  formData: HomepageFormData;
  errors: HomepageValidationErrors;
  updateField: <K extends keyof HomepageFormData>(
    key: K,
    value: HomepageFormData[K]
  ) => void;
}

export default function AnnouncementSection({
  formData,
  errors,
  updateField,
}: AnnouncementSectionProps) {
  return (
    <FormSection
      title="Announcement"
      description="Displayed at the top of the homepage."
    >
      <FormTextArea
        label="Announcement"
        value={formData.announcement}
        error={errors.announcement}
        rows={4}
        placeholder="Enter latest temple announcement..."
        onChange={(e) =>
          updateField("announcement", e.target.value)
        }
      />
    </FormSection>
  );
}
