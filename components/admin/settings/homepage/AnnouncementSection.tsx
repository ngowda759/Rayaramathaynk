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
      title="Announcements"
      description="Manage homepage announcements."
    >
      {/* Main Announcement - Hero Banner */}
      <div className="space-y-4">
        <FormTextArea
          label="Main Announcement (Hero Banner)"
          value={formData.announcement}
          error={errors.announcement}
          rows={4}
          placeholder="Enter latest temple announcement..."
          onChange={(e) =>
            updateField("announcement", e.target.value)
          }
        />
        
        <div className="border-t border-stone-200 pt-4">
          <FormTextArea
            label="Dashboard Announcement"
            value={formData.announcement2 || ""}
            error={errors.announcement2}
            rows={3}
            placeholder="Enter a special announcement for the dashboard (e.g., Aaradhane dates, special events)..."
            onChange={(e) =>
              updateField("announcement2", e.target.value)
            }
          />
          <p className="mt-1 text-xs text-stone-500">
            Featured announcement for the Daily Spiritual Dashboard section
          </p>
        </div>
      </div>
    </FormSection>
  );
}
