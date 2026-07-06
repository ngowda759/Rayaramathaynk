"use client";

import { useForm } from "react-hook-form";

import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import SettingsCard from "@/components/admin/settings/SettingsCard";
import { TempleSettings } from "@/types/temple";

interface TempleDetailsForm {
  name: string;
  subtitle: string;
  logo: string;
}

interface TempleDetailsCardProps {
  temple: TempleSettings;
}

export default function TempleDetailsCard({
  temple,
}: TempleDetailsCardProps) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<TempleDetailsForm>({
    defaultValues: {
      name: temple.name,
      subtitle: temple.subtitle,
      logo: temple.logo,
    },
  });

  function submit(data: TempleDetailsForm) {
    console.log("Temple Details", data);
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <SettingsCard
        title="Temple Details"
        description="Update the basic information displayed throughout the website."
        footer={
          <Button type="submit" loading={isSubmitting}>
            Save Changes
          </Button>
        }
      >
        <div className="space-y-6">
          <Input
            label="Temple Name"
            placeholder="Sri Raghavendra Swamy Matha"
            {...register("name")}
          />

          <Input
            label="Subtitle"
            placeholder="Yelahanka New Town, Bengaluru"
            {...register("subtitle")}
          />

          <Input
            label="Logo URL"
            placeholder="https://..."
            {...register("logo")}
          />
        </div>
      </SettingsCard>
    </form>
  );
}
