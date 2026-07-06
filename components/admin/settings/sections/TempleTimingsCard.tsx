"use client";

import { useFormContext } from "react-hook-form";

import Input from "@/components/ui/input";
import SettingsCard from "@/components/admin/settings/SettingsCard";
import { TempleSettings } from "@/types/temple";

export default function TempleTimingsCard() {
  const { register } = useFormContext<TempleSettings>();

  return (
    <SettingsCard
      title="Temple Timings"
      description="Manage daily opening and closing timings."
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Input
          type="time"
          label="Morning Open"
          {...register("timings.morning.open")}
        />

        <Input
          type="time"
          label="Morning Close"
          {...register("timings.morning.close")}
        />

        <Input
          type="time"
          label="Evening Open"
          {...register("timings.evening.open")}
        />

        <Input
          type="time"
          label="Evening Close"
          {...register("timings.evening.close")}
        />
      </div>
    </SettingsCard>
  );
}
