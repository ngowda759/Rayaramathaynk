"use client";

import { TempleSettings } from "@/types/temple";
import TempleStatusCard from "./sections/TempleStatusCard";
import ContactCard from "./sections/ContactCard";
import TempleDetailsCard from "./sections/TempleDetailsCard";
import TempleTimingsCard from "./sections/TempleTimingsCard";

interface TempleInformationFormProps {
  temple: TempleSettings;
}

export default function TempleInformationForm({
  temple,
}: TempleInformationFormProps) {
  return (
    <div className="space-y-6">
      <TempleDetailsCard temple={temple} />

      <TempleTimingsCard temple={temple} />
      <TempleStatusCard temple={temple} />
      <ContactCard temple={temple} />
    </div>
  );
}
