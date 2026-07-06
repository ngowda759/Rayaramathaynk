"use client";

import FormSection from "@/components/ui/form/FormSection";
import FormTextField from "@/components/ui/form/FormTextField";

import {
  HomepageFormData,
  HomepageValidationErrors,
} from "./types";

interface TimingsSectionProps {
  formData: HomepageFormData;
  errors: HomepageValidationErrors;
  updateField: <K extends keyof HomepageFormData>(
    key: K,
    value: HomepageFormData[K]
  ) => void;
}

export default function TimingsSection({
  formData,
  errors,
  updateField,
}: TimingsSectionProps) {
  return (
    <>
      <FormSection
        title="Temple Information"
        description="Basic information displayed across the homepage."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <FormTextField
            label="Temple Name"
            required
            value={formData.templeName}
            error={errors.templeName}
            onChange={(e) =>
              updateField("templeName", e.target.value)
            }
          />

          <FormTextField
            label="Temple Location"
            required
            value={formData.templeLocation}
            error={errors.templeLocation}
            onChange={(e) =>
              updateField("templeLocation", e.target.value)
            }
          />
        </div>
      </FormSection>

      <FormSection
        title="Temple Timings"
        description="Temple opening and closing timings."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <FormTextField
            label="Morning Open"
            required
            value={formData.morningOpen}
            error={errors.morningOpen}
            placeholder="06:00 AM"
            onChange={(e) =>
              updateField("morningOpen", e.target.value)
            }
          />

          <FormTextField
            label="Morning Close"
            required
            value={formData.morningClose}
            error={errors.morningClose}
            placeholder="12:00 PM"
            onChange={(e) =>
              updateField("morningClose", e.target.value)
            }
          />

          <FormTextField
            label="Evening Open"
            required
            value={formData.eveningOpen}
            error={errors.eveningOpen}
            placeholder="05:00 PM"
            onChange={(e) =>
              updateField("eveningOpen", e.target.value)
            }
          />

          <FormTextField
            label="Evening Close"
            required
            value={formData.eveningClose}
            error={errors.eveningClose}
            placeholder="08:30 PM"
            onChange={(e) =>
              updateField("eveningClose", e.target.value)
            }
          />
        </div>
      </FormSection>

      <FormSection
        title="Featured Festival"
        description="Festival highlighted on the homepage."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <FormTextField
            label="Festival Name"
            value={formData.featuredFestival}
            error={errors.featuredFestival}
            onChange={(e) =>
              updateField("featuredFestival", e.target.value)
            }
          />

          <FormTextField
            label="Festival Date"
            value={formData.festivalDate}
            error={errors.festivalDate}
            placeholder="DD MMM YYYY"
            onChange={(e) =>
              updateField("festivalDate", e.target.value)
            }
          />
        </div>
      </FormSection>

      <FormSection
        title="Donation Section"
        description="Homepage donation call-to-action."
      >
        <div className="space-y-6">
          <FormTextField
            label="Donation Title"
            required
            value={formData.donationTitle}
            error={errors.donationTitle}
            onChange={(e) =>
              updateField("donationTitle", e.target.value)
            }
          />

          <FormTextField
            label="Donation Subtitle"
            value={formData.donationSubtitle}
            error={errors.donationSubtitle}
            onChange={(e) =>
              updateField("donationSubtitle", e.target.value)
            }
          />
        </div>
      </FormSection>

      <FormSection
        title="Footer"
        description="Footer information."
      >
        <FormTextField
          label="Copyright"
          value={formData.footerCopyright}
          error={errors.footerCopyright}
          placeholder="© 2026 Sri Raghavendra Swamy Matha"
          onChange={(e) =>
            updateField("footerCopyright", e.target.value)
          }
        />
      </FormSection>
    </>
  );
}
