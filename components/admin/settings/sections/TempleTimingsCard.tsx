"use client";

import { useForm } from "react-hook-form";

import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import SettingsCard from "@/components/admin/settings/SettingsCard";
import { TempleSettings } from "@/types/temple";

interface TempleTimingsForm {
  morningOpen: string;
  morningClose: string;
  eveningOpen: string;
  eveningClose: string;
}

interface TempleTimingsCardProps {
  temple: TempleSettings;
}

export default function TempleTimingsCard({
  temple,
}: TempleTimingsCardProps) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<TempleTimingsForm>({
    defaultValues: {
      morningOpen: temple.timings.morning.open,
      morningClose: temple.timings.morning.close,
      eveningOpen: temple.timings.evening.open,
      eveningClose: temple.timings.evening.close,
    },
  });

  function submit(data: TempleTimingsForm) {
    console.log("Temple Timings", data);
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <SettingsCard
        title="Temple Timings"
        description="Manage daily opening and closing timings."
        footer={
          <Button type="submit" loading={isSubmitting}>
            Save Changes
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Input
            type="time"
            label="Morning Open"
            {...register("morningOpen")}
          />

          <Input
            type="time"
            label="Morning Close"
            {...register("morningClose")}
          />

          <Input
            type="time"
            label="Evening Open"
            {...register("eveningOpen")}
          />

          <Input
            type="time"
            label="Evening Close"
            {...register("eveningClose")}
          />
        </div>
      </SettingsCard>
    </form>
  );
}
