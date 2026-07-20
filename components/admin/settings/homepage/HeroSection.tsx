"use client";

import FormSection from "@/components/ui/form/FormSection";
import FormTextField from "@/components/ui/form/FormTextField";

import { HomepageFormData, HomepageValidationErrors } from "./types";

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
  // Helper to update heroStats nested fields
  const updateHeroStat = (
    statKey: keyof NonNullable<HomepageFormData["heroStats"]>,
    value: string
  ) => {
    const currentStats = formData.heroStats ?? {
      stat1Label: "Daily",
      stat1Value: "Pooja",
      stat1Description: "",
      stat2Label: "365",
      stat2Value: "Days of Seva",
      stat2Description: "",
      stat3Label: "Guru",
      stat3Value: "Blessings",
      stat3Description: "",
    };
    updateField("heroStats", {
      ...currentStats,
      [statKey]: value,
    });
  };

  return (
    <>
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
            label="Primary Button"
            value={formData.heroPrimaryButton}
            error={errors.heroPrimaryButton}
            onChange={(e) =>
              updateField("heroPrimaryButton", e.target.value)
            }
          />

          <FormTextField
            label="Secondary Button"
            value={formData.heroSecondaryButton}
            error={errors.heroSecondaryButton}
            onChange={(e) =>
              updateField("heroSecondaryButton", e.target.value)
            }
          />
        </div>
      </FormSection>

      <FormSection
        title="Hero Statistics"
        description="Configure the statistics displayed below the hero buttons (e.g., Daily Pooja, 365 Days of Seva, Guru Blessings)."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {/* Stat 1 */}
          <div className="space-y-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
            <h4 className="font-medium text-stone-700">Stat 1</h4>
            <FormTextField
              label="Label"
              value={formData.heroStats?.stat1Label ?? "Daily"}
              onChange={(e) => updateHeroStat("stat1Label", e.target.value)}
              placeholder="e.g., Daily"
            />
            <FormTextField
              label="Value"
              value={formData.heroStats?.stat1Value ?? "Pooja"}
              onChange={(e) => updateHeroStat("stat1Value", e.target.value)}
              placeholder="e.g., Pooja"
            />
          </div>

          {/* Stat 2 */}
          <div className="space-y-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
            <h4 className="font-medium text-stone-700">Stat 2</h4>
            <FormTextField
              label="Label"
              value={formData.heroStats?.stat2Label ?? "365"}
              onChange={(e) => updateHeroStat("stat2Label", e.target.value)}
              placeholder="e.g., 365"
            />
            <FormTextField
              label="Value"
              value={formData.heroStats?.stat2Value ?? "Days of Seva"}
              onChange={(e) => updateHeroStat("stat2Value", e.target.value)}
              placeholder="e.g., Days of Seva"
            />
          </div>

          {/* Stat 3 */}
          <div className="space-y-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
            <h4 className="font-medium text-stone-700">Stat 3</h4>
            <FormTextField
              label="Label"
              value={formData.heroStats?.stat3Label ?? "Guru"}
              onChange={(e) => updateHeroStat("stat3Label", e.target.value)}
              placeholder="e.g., Guru"
            />
            <FormTextField
              label="Value"
              value={formData.heroStats?.stat3Value ?? "Blessings"}
              onChange={(e) => updateHeroStat("stat3Value", e.target.value)}
              placeholder="e.g., Blessings"
            />
          </div>
        </div>
      </FormSection>
    </>
  );
}
