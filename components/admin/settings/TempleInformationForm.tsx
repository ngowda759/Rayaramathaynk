"use client";

import TempleDetailsCard from "./sections/TempleDetailsCard";
import { TempleSettings } from "@/types/temple";

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
