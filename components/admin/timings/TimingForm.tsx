"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import FormActions from "@/components/ui/form/FormActions";
import FormContainer from "@/components/ui/form/FormContainer";
import FormSection from "@/components/ui/form/FormSection";
import FormNumberField from "@/components/ui/form/FormNumberField";
import FormSwitchField from "@/components/ui/form/FormSwitchField";
import FormTextArea from "@/components/ui/form/FormTextArea";
import FormTextField from "@/components/ui/form/FormTextField";

import {
  TempleTiming,
  TimingRequest,
} from "@/types/timing";

interface TimingFormProps {
  mode: "create" | "edit";
  loading?: boolean;
  initialValues?: Partial<TempleTiming>;
  onSubmit: (
    data: TimingRequest
  ) => Promise<void> | void;
}

export default function TimingForm({
  mode,
  loading = false,
  initialValues,
  onSubmit,
}: TimingFormProps) {
  const router = useRouter();

  const [formData, setFormData] =
    useState<TimingRequest>({
      title: initialValues?.title ?? "",
      description:
        initialValues?.description ?? "",
      startTime:
        initialValues?.startTime ?? "",
      endTime:
        initialValues?.endTime ?? "",
      order: initialValues?.order ?? 0,
      isActive:
        initialValues?.isActive ?? true,
    });

  const [errors, setErrors] = useState<
    Record<string, string>
  >({});

  function updateField<
    K extends keyof TimingRequest
  >(key: K, value: TimingRequest[K]) {
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

    if (!formData.startTime) {
      validationErrors.startTime =
        "Start time is required.";
    }

    if (!formData.endTime) {
      validationErrors.endTime =
        "End time is required.";
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
        title="Temple Timing"
        description="Timing details"
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
          label="Description"
          value={formData.description}
          onChange={(e) =>
            updateField(
              "description",
              e.target.value
            )
          }
        />

        <div className="grid gap-6 md:grid-cols-2">
          <FormTextField
            type="time"
            label="Start Time"
            required
            value={formData.startTime}
            error={errors.startTime}
            onChange={(e) =>
              updateField(
                "startTime",
                e.target.value
              )
            }
          />

          <FormTextField
            type="time"
            label="End Time"
            required
            value={formData.endTime}
            error={errors.endTime}
            onChange={(e) =>
              updateField(
                "endTime",
                e.target.value
              )
            }
          />
        </div>

        <FormNumberField
          label="Display Order"
          value={formData.order}
          onChange={(e) =>
            updateField(
              "order",
              Number(e.target.value)
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
            ? "Create Timing"
            : "Update Timing"
        }
        onCancel={() =>
          router.push("/admin/timings")
        }
      />
    </FormContainer>
  );
}
