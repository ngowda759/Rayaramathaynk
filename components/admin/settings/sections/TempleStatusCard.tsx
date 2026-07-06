"use client";

import { Controller, useFormContext } from "react-hook-form";

import SettingsCard from "@/components/admin/settings/SettingsCard";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TempleSettings } from "@/types/temple";

export default function TempleStatusCard() {
  const { register, control } =
    useFormContext<TempleSettings>();

  return (
    <SettingsCard
      title="Temple Status"
      description="Control the current temple status displayed on the website."
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border border-stone-200 p-4">
          <div>
            <h3 className="font-medium text-stone-900">
              Temple Open
            </h3>

            <p className="text-sm text-stone-500">
              Toggle whether the temple is currently open.
            </p>
          </div>

          <Controller
            control={control}
            name="status.isOpen"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>

        <Textarea
          label="Special Message"
          placeholder="Closed for festival preparations..."
          {...register("status.message")}
        />
      </div>
    </SettingsCard>
  );
}
