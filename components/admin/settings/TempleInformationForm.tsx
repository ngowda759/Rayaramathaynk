"use client";

import { TempleSettings } from "@/types/temple";

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
    </div>
  );
}
