"use client";

import { useForm } from "react-hook-form";

import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SettingsCard from "@/components/admin/settings/SettingsCard";
import { TempleSettings } from "@/types/temple";

interface ContactForm {
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  googleMaps: string;
}

interface ContactCardProps {
  temple: TempleSettings;
}

export default function ContactCard({
  temple,
}: ContactCardProps) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ContactForm>({
    defaultValues: {
      phone: temple.contact.phone,
      email: temple.contact.email,
      address: temple.address.line1,
      city: temple.address.city,
      state: temple.address.state,
      pincode: temple.address.pincode,
      googleMaps: temple.location.googleMaps,
    },
  });

  function submit(data: ContactForm) {
    console.log("Contact", data);
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <SettingsCard
        title="Contact Information"
        description="Manage contact and location details."
        footer={
          <Button type="submit" loading={isSubmitting}>
            Save Changes
          </Button>
        }
      >
        <div className="space-y-5">
          <Input
            label="Phone Number"
            {...register("phone")}
          />

          <Input
            label="Email Address"
            type="email"
            {...register("email")}
          />

          <Textarea
            label="Address"
            {...register("address")}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input
              label="City"
              {...register("city")}
            />

            <Input
              label="State"
              {...register("state")}
            />

            <Input
              label="Pincode"
              {...register("pincode")}
            />
          </div>

          <Input
            label="Google Maps URL"
            {...register("googleMaps")}
          />
        </div>
      </SettingsCard>
    </form>
  );
}
