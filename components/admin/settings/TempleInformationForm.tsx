"use client";

import { FormProvider, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

import Button from "@/components/ui/button";
import { updateTempleSettings } from "@/lib/settings/temple";
import { TempleSettings } from "@/types/temple";

import TempleDetailsCard from "./sections/TempleDetailsCard";
import TempleTimingsCard from "./sections/TempleTimingsCard";
import TempleStatusCard from "./sections/TempleStatusCard";
import ContactCard from "./sections/ContactCard";

interface TempleInformationFormProps {
  temple: TempleSettings;
}

export default function TempleInformationForm({
  temple,
}: TempleInformationFormProps) {
  const form = useForm<TempleSettings>({
    defaultValues: temple,
  });

  const {
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
  } = form;

  async function onSubmit(data: TempleSettings) {
    try {
      await updateTempleSettings(data);

      reset(data);

      toast.success("Temple details updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update temple details");
    }
  }

  return (
    <FormProvider {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <TempleDetailsCard />

        <TempleTimingsCard />

        <TempleStatusCard />

        <ContactCard />

        <div className="flex justify-end">
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={!isDirty}
          >
            Save All Changes
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
