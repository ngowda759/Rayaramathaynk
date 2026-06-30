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
    <>
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

      <FormSection
        title="Today's Panchanga"
        description="Displayed on the homepage."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <FormTextArea
            label="Tithi"
            value={formData.panchanga?.tithi ?? ""}
            rows={2}
            onChange={(e) =>
              updateField("panchanga", {
                ...formData.panchanga!,
                tithi: e.target.value,
              })
            }
          />

          <FormTextArea
            label="Nakshatra"
            value={formData.panchanga?.nakshatra ?? ""}
            rows={2}
            onChange={(e) =>
              updateField("panchanga", {
                ...formData.panchanga!,
                nakshatra: e.target.value,
              })
            }
          />

          <FormTextArea
            label="Yoga"
            value={formData.panchanga?.yoga ?? ""}
            rows={2}
            onChange={(e) =>
              updateField("panchanga", {
                ...formData.panchanga!,
                yoga: e.target.value,
              })
            }
          />

          <FormTextArea
            label="Karana"
            value={formData.panchanga?.karana ?? ""}
            rows={2}
            onChange={(e) =>
              updateField("panchanga", {
                ...formData.panchanga!,
                karana: e.target.value,
              })
            }
          />
        </div>
      </FormSection>
    </>
  );
}
