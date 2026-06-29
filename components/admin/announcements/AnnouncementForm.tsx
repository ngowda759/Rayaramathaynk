"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import FormActions from "@/components/ui/form/FormActions";
import FormContainer from "@/components/ui/form/FormContainer";
import FormSection from "@/components/ui/form/FormSection";
import FormSwitchField from "@/components/ui/form/FormSwitchField";
import FormTextArea from "@/components/ui/form/FormTextArea";
import FormTextField from "@/components/ui/form/FormTextField";

import {
  Announcement,
  AnnouncementRequest,
} from "@/types/announcement";

interface AnnouncementFormProps {
  mode: "create" | "edit";
  loading?: boolean;
  initialValues?: Partial<Announcement>;
  onSubmit: (
    data: AnnouncementRequest
  ) => Promise<void> | void;
}

export default function AnnouncementForm({
  mode,
  loading = false,
  initialValues,
  onSubmit,
}: AnnouncementFormProps) {
  const router = useRouter();

  const [formData, setFormData] =
    useState<AnnouncementRequest>({
      title: initialValues?.title ?? "",
      message: initialValues?.message ?? "",
      link: initialValues?.link ?? "",
      isActive: initialValues?.isActive ?? true,
    });

  const [errors, setErrors] = useState<
    Record<string, string>
  >({});

  function updateField<
    K extends keyof AnnouncementRequest
  >(key: K, value: AnnouncementRequest[K]) {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));

    if (errors[key]) {
      setErrors((prev) => ({
        ...prev,
        [key]: "",
      }));
    }
  }

  function validate() {
    const validationErrors: Record<
      string,
      string
    > = {};

    if (!formData.title.trim()) {
      validationErrors.title =
        "Title is required.";
    }

    if (!formData.message.trim()) {
      validationErrors.message =
        "Message is required.";
    }

    setErrors(validationErrors);

    return (
      Object.keys(validationErrors).length === 0
    );
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!validate()) return;

    await onSubmit(formData);
  }

  return (
    <FormContainer onSubmit={handleSubmit}>
      <FormSection
        title="Announcement"
        description="Announcement details"
      >
        <FormTextField
          label="Title"
          required
          value={formData.title}
          error={errors.title}
          onChange={(e) =>
            updateField(
              "title",
              e.target.value
            )
          }
        />

        <FormTextArea
          label="Message"
          value={formData.message}
          error={errors.message}
          onChange={(e) =>
            updateField(
              "message",
              e.target.value
            )
          }
        />

        <FormTextField
          label="Link"
          value={formData.link}
          onChange={(e) =>
            updateField(
              "link",
              e.target.value
            )
          }
        />

        <FormSwitchField
          label="Active"
          checked={formData.isActive}
          onChange={(checked) =>
            updateField(
              "isActive",
              checked
            )
          }
        />
      </FormSection>

      <FormActions
        loading={loading}
        submitLabel={
          mode === "create"
            ? "Create Announcement"
            : "Update Announcement"
        }
        onCancel={() =>
          router.push(
            "/admin/announcements"
          )
        }
      />
    </FormContainer>
  );
}
