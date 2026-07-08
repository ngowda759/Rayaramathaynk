"use client";

import { Plus, Trash2 } from "lucide-react";
import FormSection from "@/components/ui/form/FormSection";
import FormTextField from "@/components/ui/form/FormTextField";
import FormTextArea from "@/components/ui/form/FormTextArea";
import { HomepageFormData } from "./types";
import { DonationItem } from "@/types/homepage";

interface DonationSectionProps {
  formData: HomepageFormData;
  errors: Record<string, string>;
  updateField: <K extends keyof HomepageFormData>(
    key: K,
    value: HomepageFormData[K]
  ) => void;
}

export default function DonationSection({
  formData,
  updateField,
}: DonationSectionProps) {
  const donationCTA = formData.donationCTA || {
    title: "SUPPORT THE TEMPLE",
    subtitle: "Every Contribution Matters",
    items: [],
    ctaTitle: "Be a Part of Divine Service",
    ctaDescription: "Every offering, regardless of its size, supports the temple's daily rituals, festivals and charitable activities for the benefit of all devotees.",
    ctaButtonText: "Donate Now",
  };

  const items: DonationItem[] = donationCTA.items?.length > 0 
    ? donationCTA.items 
    : [
        { id: "1", title: "Annadanam", amount: "501", description: "Sponsor prasada and meals for devotees visiting the temple." },
        { id: "2", title: "Goshala", amount: "1001", description: "Support the care and maintenance of our sacred cows." },
        { id: "3", title: "Temple Development", amount: "5001", description: "Contribute towards renovation and future development projects." },
      ];

  const updateDonationField = (field: string, value: unknown) => {
    const newCTA = { ...donationCTA, [field]: value };
    updateField("donationCTA" as keyof HomepageFormData, newCTA as HomepageFormData["donationCTA"]);
  };

  const updateItem = (index: number, field: keyof DonationItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    updateDonationField("items", newItems);
  };

  const addItem = () => {
    const newItems = [
      ...items,
      { id: Date.now().toString(), title: "", amount: "", description: "" },
    ];
    updateDonationField("items", newItems);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    updateDonationField("items", newItems);
  };

  return (
    <FormSection
      title="Support the Temple Section"
      description="Configure the donation CTA section shown on the homepage."
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FormTextField
            label="Section Title"
            value={donationCTA.title}
            onChange={(e) => updateDonationField("title", e.target.value)}
            placeholder="SUPPORT THE TEMPLE"
          />
          <FormTextField
            label="Subtitle"
            value={donationCTA.subtitle}
            onChange={(e) => updateDonationField("subtitle", e.target.value)}
            placeholder="Every Contribution Matters"
          />
        </div>

        <div>
          <h4 className="mb-4 text-lg font-medium">Donation Options</h4>
          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="rounded-xl border bg-stone-50 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-stone-600">
                    Option {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <FormTextField
                    label="Title"
                    value={item.title}
                    onChange={(e) => updateItem(index, "title", e.target.value)}
                    placeholder="Annadanam"
                  />
                  <FormTextField
                    label="Amount (in INR)"
                    value={item.amount}
                    onChange={(e) => updateItem(index, "amount", e.target.value)}
                    placeholder="501"
                  />
                  <div className="md:col-span-2">
                    <FormTextArea
                      label="Description"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      placeholder="Description of this donation option..."
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 py-3 text-stone-500 hover:border-stone-400 hover:text-stone-600"
            >
              <Plus className="h-5 w-5" />
              Add Donation Option
            </button>
          </div>
        </div>

        <div className="border-t pt-6">
          <h4 className="mb-4 text-lg font-medium">Call to Action (Bottom)</h4>
          <div className="grid gap-4">
            <FormTextField
              label="CTA Title"
              value={donationCTA.ctaTitle}
              onChange={(e) => updateDonationField("ctaTitle", e.target.value)}
              placeholder="Be a Part of Divine Service"
            />
            <FormTextArea
              label="CTA Description"
              value={donationCTA.ctaDescription}
              onChange={(e) => updateDonationField("ctaDescription", e.target.value)}
              placeholder="Description for the bottom CTA..."
              rows={2}
            />
            <FormTextField
              label="Button Text"
              value={donationCTA.ctaButtonText}
              onChange={(e) => updateDonationField("ctaButtonText", e.target.value)}
              placeholder="Donate Now"
            />
          </div>
        </div>
      </div>
    </FormSection>
  );
}
