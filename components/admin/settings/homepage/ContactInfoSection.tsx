"use client";

import FormSection from "@/components/ui/form/FormSection";
import FormTextField from "@/components/ui/form/FormTextField";
import FormTextArea from "@/components/ui/form/FormTextArea";

import { HomepageFormData, HomepageValidationErrors } from "./types";

interface ContactInfoSectionProps {
  formData: HomepageFormData;
  errors: HomepageValidationErrors;
  updateField: <K extends keyof HomepageFormData>(
    key: K,
    value: HomepageFormData[K]
  ) => void;
}

export default function ContactInfoSection({
  formData,
  errors,
  updateField,
}: ContactInfoSectionProps) {
  return (
    <FormSection
      title="Temple Information"
      description="Contact details and address shown on the public site."
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
          label="Location"
          value={formData.templeLocation}
          error={errors.templeLocation}
          placeholder="Yelahanka New Town, Bengaluru"
          onChange={(e) =>
            updateField("templeLocation", e.target.value)
          }
        />
      </div>

      <div className="mt-6">
        <FormTextArea
          label="Address"
          value={formData.templeAddress}
          error={errors.templeAddress}
          placeholder="428/20, 8th A Cross Rd, Yelahanka Satellite Town, Yelahanka, Bengaluru, Karnataka 560064"
          rows={3}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            updateField("templeAddress", e.target.value)
          }
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <FormTextField
          label="Contact Email"
          type="email"
          value={formData.contactEmail}
          error={errors.contactEmail}
          onChange={(e) =>
            updateField("contactEmail", e.target.value)
          }
        />

        <FormTextField
          label="Contact Phone"
          value={formData.contactPhone}
          error={errors.contactPhone}
          onChange={(e) =>
            updateField("contactPhone", e.target.value)
          }
        />
      </div>

      <div className="mt-6">
        <FormTextField
          label="Footer Copyright"
          value={formData.footerCopyright}
          error={errors.footerCopyright}
          placeholder="© 2024 Sri Raghavendra Swamy Matha"
          onChange={(e) =>
            updateField("footerCopyright", e.target.value)
          }
        />
      </div>
    </FormSection>
  );
}
