"use client";

import { TempleSettings } from "@/types/temple";

import TempleDetailsCard from "./sections/TempleDetailsCard";

interface TempleInformationFormProps {
  temple: TempleSettings;
}

export default function TempleInformationForm({
  temple,
}: TempleInformationFormProps) {
  return (
    <div className="space-y-6">
      <TempleDetailsCard temple={temple} />
    </div>
  );
}
