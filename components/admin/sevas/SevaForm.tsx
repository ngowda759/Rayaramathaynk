"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import FormContainer from "@/components/ui/form/FormContainer";
import FormSection from "@/components/ui/form/FormSection";
import FormTextField from "@/components/ui/form/FormTextField";
import FormTextArea from "@/components/ui/form/FormTextArea";
import FormNumberField from "@/components/ui/form/FormNumberField";
import FormSelectField from "@/components/ui/form/FormSelectField";
import FormSwitchField from "@/components/ui/form/FormSwitchField";
import FormActions from "@/components/ui/form/FormActions";

import { Seva, SevaRequest } from "@/types/seva";
import { sevaCategoryOptions } from "./constants";

interface SevaFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<Seva>;
  loading?: boolean;
  onSubmit: (data: SevaRequest) => Promise<void> | void;
}

export default function SevaForm({
  mode,
  initialValues,
  loading = false,
  onSubmit,
}: SevaFormProps) {
  const router = useRouter();

  const [formData, setFormData] = useState<SevaRequest>({
    name: initialValues?.name ?? "",
    description: initialValues?.description ?? "",
    category: initialValues?.category ?? "",
    amount: initialValues?.amount ?? 0,
    duration: 0,
    imageUrl: initialValues?.imageUrl ?? "",
    active: initialValues?.active ?? true,
    displayOrder: initialValues?.displayOrder ?? 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof SevaRequest>(
    key: K,
    value: SevaRequest[K]
  ) {
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
    const validationErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      validationErrors.name = "Seva name is required.";
    }

    if (!formData.category) {
      validationErrors.category = "Category is required.";
    }

    if (formData.amount <= 0) {
      validationErrors.amount = "Amount must be greater than zero.";
    }

    setErrors(validationErrors);

    return Object.keys(validationErrors).length === 0;
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    await onSubmit(formData);
  }

  return (
    <FormContainer onSubmit={handleSubmit}>
      <FormSection
        title="Seva Information"
        description="Basic information about the seva."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <FormTextField
            label="Seva Name"
            value={formData.name}
            required
            error={errors.name}
            onChange={(e) => updateField("name", e.target.value)}
          />

          <FormSelectField
            label="Category"
            value={formData.category}
            required
            error={errors.category}
            options={sevaCategoryOptions}
            onChange={(e) => updateField("category", e.target.value)}
          />
        </div>

        <FormTextArea
          label="Description"
          value={formData.description}
          onChange={(e) => updateField("description", e.target.value)}
        />
      </FormSection>

      <FormSection
        title="Pricing"
        description="Configure seva pricing."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <FormNumberField
            label="Amount (₹)"
            value={formData.amount}
            required
            error={errors.amount}
            onChange={(e) =>
              updateField("amount", Number(e.target.value))
            }
          />

          <FormNumberField
            label="Display Order"
            value={formData.displayOrder}
            onChange={(e) =>
              updateField("displayOrder", Number(e.target.value))
            }
          />
        </div>
      </FormSection>

      <FormSection
        title="Additional"
        description="Optional information."
      >
        <FormTextField
          label="Image URL"
          value={formData.imageUrl}
          onChange={(e) => updateField("imageUrl", e.target.value)}
        />

        <FormSwitchField
          label="Status"
          checked={formData.active}
          onChange={(checked) => updateField("active", checked)}
        />
      </FormSection>

      <FormActions
        loading={loading}
        submitLabel={
          mode === "create"
            ? "Create Seva"
            : "Update Seva"
        }
        onCancel={() => router.push("/admin/sevas")}
      />
    </FormContainer>
  );
}
