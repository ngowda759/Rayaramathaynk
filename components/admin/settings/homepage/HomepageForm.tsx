"use client";

import { useRouter } from "next/navigation";

import FormContainer from "@/components/ui/form/FormContainer";
import FormActions from "@/components/ui/form/FormActions";

import { HomepageSettingsProps } from "./types";
import { useHomepageForm } from "./useHomepageForm";

import HeroSection from "./HeroSection";
import AnnouncementSection from "./AnnouncementSection";
import TimingsSection from "./TimingsSection";
import TestimonialsSection from "./TestimonialsSection";
import ContactInfoSection from "./ContactInfoSection";

export default function HomepageForm({
  onSaved,
}: HomepageSettingsProps) {
  const router = useRouter();

  const {
    formData,
    loading,
    saving,
    errors,
    statusMessage,
    updateField,
    save,
  } = useHomepageForm();

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    const success = await save();

    if (success) {
      onSaved?.();
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <p className="text-sm text-stone-500">
          Loading homepage settings...
        </p>
      </div>
    );
  }

  return (
    <>
      {statusMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          {statusMessage}
        </div>
      ) : null}

      <FormContainer onSubmit={handleSubmit}>
        <HeroSection
          formData={formData}
          errors={errors}
          updateField={updateField}
        />

        <ContactInfoSection
          formData={formData}
          errors={errors}
          updateField={updateField}
        />

        <AnnouncementSection
          formData={formData}
          errors={errors}
          updateField={updateField}
        />

        <TimingsSection
          formData={formData}
          errors={errors}
          updateField={updateField}
        />

        <TestimonialsSection
          formData={formData}
          errors={errors}
          updateField={updateField}
        />

        <FormActions
          loading={saving}
          submitLabel="Save Homepage Settings"
          onCancel={() => router.push("/admin")}
        />
      </FormContainer>
    </>
  );
}
