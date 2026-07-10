"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import FormActions from "@/components/ui/form/FormActions";
import FormContainer from "@/components/ui/form/FormContainer";
import FormNumberField from "@/components/ui/form/FormNumberField";
import FormSection from "@/components/ui/form/FormSection";
import FormSelectField from "@/components/ui/form/FormSelectField";
import FormSwitchField from "@/components/ui/form/FormSwitchField";
import FormTextArea from "@/components/ui/form/FormTextArea";
import FormTextField from "@/components/ui/form/FormTextField";

import {
  GalleryImage,
  GalleryImageRequest,
  GalleryCategory,
} from "@/types/gallery";

import { galleryCategoryOptions } from "./constants";

interface GalleryFormProps {
  mode: "create" | "edit";
  loading?: boolean;
  initialValues?: Partial<GalleryImage>;
  onSubmit: (
    data: GalleryImageRequest
  ) => Promise<void> | void;
}

export default function GalleryForm({
  mode,
  loading = false,
  initialValues,
  onSubmit,
}: GalleryFormProps) {
  const router = useRouter();

  const [formData, setFormData] =
    useState<GalleryImageRequest>({
      title: initialValues?.title ?? "",
      description:
        initialValues?.description ?? "",
      category:
        initialValues?.category ?? "Other",
      imagePath:
        initialValues?.imagePath ?? "",
      altText:
        initialValues?.altText ?? "",
      isFeatured:
        initialValues?.isFeatured ?? false,
      displayOrder:
        initialValues?.displayOrder ?? 0,
      tags: initialValues?.tags ?? [],
    });

  const [tagInput, setTagInput] = useState(
    (initialValues?.tags ?? []).join(", ")
  );

  const [errors, setErrors] = useState<
    Record<string, string>
  >({});

  function updateField<
    K extends keyof GalleryImageRequest
  >(key: K, value: GalleryImageRequest[K]) {
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

    if (!formData.imagePath.trim()) {
      validationErrors.imagePath =
        "Image Path is required.";
    }

    if (!formData.altText.trim()) {
      validationErrors.altText =
        "Alt Text is required.";
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

    await onSubmit({
      ...formData,
      tags: tagInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
  }

  return (
    <FormContainer onSubmit={handleSubmit}>
      <FormSection
        title="Image Information"
        description="Basic details"
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

        <FormSelectField
          label="Category"
          value={formData.category}
          options={galleryCategoryOptions}
          onChange={(e) =>
            updateField(
              "category",
              e.target.value as GalleryCategory
            )
          }
        />
      </FormSection>

      <FormSection
        title="Image"
        description="Image metadata"
      >
        <FormTextField
          label="Image Path"
          required
          value={formData.imagePath}
          error={errors.imagePath}
          onChange={(e) =>
            updateField(
              "imagePath",
              e.target.value
            )
          }
        />

        <FormTextField
          label="Alt Text"
          required
          value={formData.altText}
          error={errors.altText}
          onChange={(e) =>
            updateField(
              "altText",
              e.target.value
            )
          }
        />
      </FormSection>

      <FormSection
        title="Display"
        description="Display settings"
      >
        <FormNumberField
          label="Display Order"
          value={formData.displayOrder}
          onChange={(e) =>
            updateField(
              "displayOrder",
              Number(e.target.value)
            )
          }
        />

        <FormSwitchField
          label="Featured"
          checked={formData.isFeatured}
          onChange={(checked) =>
            updateField(
              "isFeatured",
              checked
            )
          }
        />

        <div className="space-y-2">
          <FormTextField
            label="Tags"
            value={tagInput}
            onChange={(e) =>
              setTagInput(e.target.value)
            }
          />

          <p className="text-xs text-stone-500">
            Enter comma-separated tags
            (e.g. rathotsava, temple,
            2026)
          </p>
        </div>
      </FormSection>

      <FormActions
        loading={loading}
        submitLabel={
          mode === "create"
            ? "Create Image"
            : "Update Image"
        }
        onCancel={() =>
          router.push("/admin/gallery")
        }
      />
    </FormContainer>
  );
}
