"use client";

import FormSection from "@/components/ui/form/FormSection";
import FormTextField from "@/components/ui/form/FormTextField";

import {
  HomepageFormData,
  HomepageValidationErrors,
} from "./types";

interface HeroSectionProps {
  formData: HomepageFormData;
  errors: HomepageValidationErrors;
  updateField: <K extends keyof HomepageFormData>(
    key: K,
    value: HomepageFormData[K]
  ) => void;
}

export default function HeroSection({
  formData,
  errors,
  updateField,
}: HeroSectionProps) {
  return (
    <FormSection
      title="Hero Section"
      description="Configure the homepage hero banner."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <FormTextField
          label="Hero Title"
          required
          value={formData.heroTitle}
          error={errors.heroTitle}
          onChange={(e) =>
            updateField("heroTitle", e.target.value)
          }
        />

        <FormTextField
          label="Hero Subtitle"
          required
          value={formData.heroSubtitle}
          error={errors.heroSubtitle}
          onChange={(e) =>
            updateField("heroSubtitle", e.target.value)
          }
        />
      </div>

      <div className="mt-6">
        <FormTextField
          label="Hero Image"
          value={formData.heroImage}
          error={errors.heroImage}
          placeholder="/images/hero.jpg"
          onChange={(e) =>
            updateField("heroImage", e.target.value)
          }
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <FormTextField
          label="Primary Button Text"
          value={formData.heroPrimaryButton}
          error={errors.heroPrimaryButton}
          onChange={(e) =>
            updateField("heroPrimaryButton", e.target.value)
          }
        />

        <FormTextField
          label="Primary Button Link"
          value={formData.heroPrimaryButtonLink}
          placeholder="/sevas"
          onChange={(e) =>
            updateField(
              "heroPrimaryButtonLink",
              e.target.value
            )
          }
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <FormTextField
          label="Secondary Button Text"
          value={formData.heroSecondaryButton}
          error={errors.heroSecondaryButton}
          onChange={(e) =>
            updateField("heroSecondaryButton", e.target.value)
          }
        />

        <FormTextField
          label="Secondary Button Link"
          value={formData.heroSecondaryButtonLink}
          placeholder="/donation"
          onChange={(e) =>
            updateField(
              "heroSecondaryButtonLink",
              e.target.value
            )
          }
        />
      </div>
    </FormSection>
  );
}
