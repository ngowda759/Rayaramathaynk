"use client";

import FormSection from "@/components/ui/form/FormSection";
import FormTextField from "@/components/ui/form/FormTextField";
import FormTextArea from "@/components/ui/form/FormTextArea";

import {
  HomepageFormData,
  HomepageValidationErrors,
} from "./types";

interface TimingsSectionProps {
  formData: HomepageFormData;
  errors: HomepageValidationErrors;
  updateField: <K extends keyof HomepageFormData>(
    key: K,
    value: HomepageFormData[K]
  ) => void;
}

export default function TimingsSection({
  formData,
  errors,
  updateField,
}: TimingsSectionProps) {
  const handleMorningScheduleChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    const items = value
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    updateField("morningSchedule", items);
  };

  const handleEveningScheduleChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    const items = value
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    updateField("eveningSchedule", items);
  };

  return (
    <>
      <FormSection
        title="Temple Timings"
        description="Temple opening and closing timings."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <FormTextField
            label="Morning Open"
            required
            value={formData.morningOpen}
            error={errors.morningOpen}
            placeholder="06:00 AM"
            onChange={(e) =>
              updateField("morningOpen", e.target.value)
            }
          />

          <FormTextField
            label="Morning Close"
            required
            value={formData.morningClose}
            error={errors.morningClose}
            placeholder="12:00 PM"
            onChange={(e) =>
              updateField("morningClose", e.target.value)
            }
          />

          <FormTextField
            label="Evening Open"
            required
            value={formData.eveningOpen}
            error={errors.eveningOpen}
            placeholder="05:00 PM"
            onChange={(e) =>
              updateField("eveningOpen", e.target.value)
            }
          />

          <FormTextField
            label="Evening Close"
            required
            value={formData.eveningClose}
            error={errors.eveningClose}
            placeholder="08:30 PM"
            onChange={(e) =>
              updateField("eveningClose", e.target.value)
            }
          />
        </div>
      </FormSection>

      <FormSection
        title="Morning Darshan Schedule"
        description="Schedule items displayed in the Morning Darshan section. Enter one item per line."
      >
        <FormTextArea
          label="Morning Schedule Items"
          value={formData.morningSchedule.join("\n")}
          onChange={handleMorningScheduleChange}
          placeholder="Suprabhata Seva&#10;Alankara&#10;Darshan&#10;Theertha &amp; Prasada"
          rows={5}
        />
      </FormSection>

      <FormSection
        title="Evening Darshan Schedule"
        description="Schedule items displayed in the Evening Darshan section. Enter one item per line."
      >
        <FormTextArea
          label="Evening Schedule Items"
          value={formData.eveningSchedule.join("\n")}
          onChange={handleEveningScheduleChange}
          placeholder="Evening Pooja&#10;Mangalarati&#10;Darshan&#10;Temple Closing"
          rows={5}
        />
      </FormSection>

      <FormSection
        title="Featured Festival"
        description="Festival highlighted on the homepage."
      >
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <FormTextField
              label="Festival Name"
              value={formData.featuredFestival}
              error={errors.featuredFestival}
              onChange={(e) =>
                updateField("featuredFestival", e.target.value)
              }
            />

            <FormTextField
              label="Festival Date"
              value={formData.festivalDate}
              error={errors.festivalDate}
              placeholder="DD MMM YYYY"
              onChange={(e) =>
                updateField("festivalDate", e.target.value)
              }
            />
          </div>

          <FormTextField
            label="Festival Description"
            value={formData.featuredFestivalDescription}
            placeholder="Coming Soon / Register Now / etc."
            onChange={(e) =>
              updateField("featuredFestivalDescription", e.target.value)
            }
          />
        </div>
      </FormSection>

      <FormSection
        title="Festival Schedule Note"
        description="Text displayed below the festival schedule section."
      >
        <FormTextArea
          label="Festival Schedule Note"
          value={formData.festivalScheduleNote}
          onChange={(e) =>
            updateField("festivalScheduleNote", e.target.value)
          }
          placeholder="Temple timings may be extended during festivals..."
          rows={3}
        />
      </FormSection>

      <FormSection
        title="Today's Seva"
        description="Today's special seva displayed on the homepage hero section."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <FormTextField
            label="Today's Seva Name"
            value={formData.todaySeva}
            placeholder="Daily Pooja Morning"
            onChange={(e) =>
              updateField("todaySeva", e.target.value)
            }
          />

          <FormTextField
            label="Today's Seva Time"
            value={formData.todaySevaTime}
            placeholder="09:30 AM"
            onChange={(e) =>
              updateField("todaySevaTime", e.target.value)
            }
          />
        </div>
      </FormSection>

      <FormSection
        title="Donation Section"
        description="Homepage donation call-to-action."
      >
        <div className="space-y-6">
          <FormTextField
            label="Donation Title"
            required
            value={formData.donationTitle}
            error={errors.donationTitle}
            onChange={(e) =>
              updateField("donationTitle", e.target.value)
            }
          />

          <FormTextField
            label="Donation Subtitle"
            value={formData.donationSubtitle}
            error={errors.donationSubtitle}
            onChange={(e) =>
              updateField("donationSubtitle", e.target.value)
            }
          />
        </div>
      </FormSection>
    </>
  );
}
