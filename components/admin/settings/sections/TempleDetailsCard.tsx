"use client";

import { useFormContext } from "react-hook-form";

import Input from "@/components/ui/input";
import SettingsCard from "@/components/admin/settings/SettingsCard";
import { TempleSettings } from "@/types/temple";

export default function TempleDetailsCard() {
  const { register } = useFormContext<TempleSettings>();

  return (
    <SettingsCard
      title="Temple Details"
      description="Update the basic information displayed throughout the website."
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
  );
}
