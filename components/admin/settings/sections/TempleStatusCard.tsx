"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

import Button from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import SettingsCard from "@/components/admin/settings/SettingsCard";
import { TempleSettings } from "@/types/temple";

interface TempleStatusForm {
  message: string;
}

interface TempleStatusCardProps {
  temple: TempleSettings;
}

export default function TempleStatusCard({
  temple,
}: TempleStatusCardProps) {
  const [isOpen, setIsOpen] = useState(temple.status.isOpen);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<TempleStatusForm>({
    defaultValues: {
      message: temple.status.message,
    },
  });

  function submit(data: TempleStatusForm) {
    console.log({
      isOpen,
      message: data.message,
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <SettingsCard
        title="Temple Status"
        description="Control the current temple status displayed on the website."
        footer={
          <Button type="submit" loading={isSubmitting}>
            Save Changes
          </Button>
        }
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

            <Switch
              checked={isOpen}
              onCheckedChange={setIsOpen}
            />
          </div>

          <Textarea
            label="Special Message"
            placeholder="Closed for festival preparations..."
            {...register("message")}
          />
        </div>
      </SettingsCard>
    </form>
  );
}
