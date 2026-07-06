"use client";

import { useFormContext } from "react-hook-form";

import Input from "@/components/ui/input";
import SettingsCard from "@/components/admin/settings/SettingsCard";
import { Textarea } from "@/components/ui/textarea";
import { TempleSettings } from "@/types/temple";

export default function ContactCard() {
  const { register } =
    useFormContext<TempleSettings>();

  return (
    <SettingsCard
      title="Contact Information"
      description="Manage contact and location details."
    >
      <div className="space-y-5">
        <Input
          label="Phone Number"
          {...register("contact.phone")}
        />

        <Input
          label="Email Address"
          type="email"
          {...register("contact.email")}
        />

        <Textarea
          label="Address"
          {...register("address.line1")}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input
            label="City"
            {...register("address.city")}
          />

          <Input
            label="State"
            {...register("address.state")}
          />

          <Input
            label="Pincode"
            {...register("address.pincode")}
          />
        </div>

        <Input
          label="Google Maps URL"
          {...register("location.googleMaps")}
        />
      </div>
    </SettingsCard>
  );
}
