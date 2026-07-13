"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";
import { HomepageFormData } from "./types";
import { HomepageValidationErrors } from "./types";
import FormSection from "@/components/ui/form/FormSection";
import FormTextField from "@/components/ui/form/FormTextField";
import FormTextArea from "@/components/ui/form/FormTextArea";
import { Testimonial } from "@/types/homepage";

interface TestimonialsSectionProps {
  formData: HomepageFormData;
  errors: HomepageValidationErrors;
  updateField: <K extends keyof HomepageFormData>(
    key: K,
    value: HomepageFormData[K]
  ) => void;
}

export default function TestimonialsSection({
  formData,
  updateField,
}: TestimonialsSectionProps) {
  const testimonials = formData.testimonials || [];

  const addTestimonial = () => {
    const newTestimonial: Testimonial = {
      id: Date.now().toString(),
      name: "",
      location: "",
      quote: "",
      years: "",
    };
    updateField("testimonials", [...testimonials, newTestimonial]);
  };

  const removeTestimonial = (id: string) => {
    updateField(
      "testimonials",
      testimonials.filter((t) => t.id !== id)
    );
  };

  const updateTestimonial = (
    id: string,
    field: keyof Testimonial,
    value: string
  ) => {
    updateField(
      "testimonials",
      testimonials.map((t) =>
        t.id === id ? { ...t, [field]: value } : t
      )
    );
  };

  return (
    <FormSection
      title="Testimonials Section"
      description="Add devotee testimonials to display on the homepage."
    >
      <div className="space-y-6">
        {testimonials.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-stone-300 p-6 text-center">
            <p className="text-sm text-stone-500">
              No testimonials added yet. Click &quot;Add Testimonial&quot; to add one.
            </p>
          </div>
        )}

        {testimonials.map((testimonial, index) => (
          <div
            key={testimonial.id}
            className="relative rounded-lg border bg-stone-50 p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical
                  size={16}
                  className="text-stone-400 cursor-grab"
                />
                <span className="text-sm font-medium text-stone-600">
                  Testimonial #{index + 1}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeTestimonial(testimonial.id)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormTextField
                label="Name"
                value={testimonial.name}
                onChange={(e) =>
                  updateTestimonial(testimonial.id, "name", e.target.value)
                }
                placeholder="Devotee name"
                required
              />

              <FormTextField
                label="Location"
                value={testimonial.location}
                onChange={(e) =>
                  updateTestimonial(testimonial.id, "location", e.target.value)
                }
                placeholder="City, State"
                required
              />

              <FormTextField
                label="Duration/Badge"
                value={testimonial.years}
                onChange={(e) =>
                  updateTestimonial(testimonial.id, "years", e.target.value)
                }
                placeholder="e.g., 10 years devotee, Regular visitor"
                required
                className="md:col-span-2"
              />

              <FormTextArea
                label="Quote/Testimonial"
                value={testimonial.quote}
                onChange={(e) =>
                  updateTestimonial(testimonial.id, "quote", e.target.value)
                }
                placeholder="Share the devotee's experience..."
                rows={3}
                required
                className="md:col-span-2"
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addTestimonial}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 hover:bg-amber-100"
        >
          <Plus size={18} />
          Add Testimonial
        </button>
      </div>
    </FormSection>
  );
}
