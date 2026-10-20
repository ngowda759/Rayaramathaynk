"use client";

import type { JSX } from "react";

import { Segmented } from "@/components/seva/ui/Segmented";
import { PRASADAM } from "@/lib/seva/strings/prasadam";

export type FindMode = "scan" | "type";

export interface ScanTypeSwitchProps {
  value: FindMode;
  onChange(mode: FindMode): void;
}

/** The two equal ways in (DB §11): scan the slip's QR, or type the number printed on it. Full width, equal halves. */
export function ScanTypeSwitch({ value, onChange }: ScanTypeSwitchProps): JSX.Element {
  return (
    <div className="[&_[role=radio]]:min-h-12 [&_[role=radio]]:flex-1 [&>[role=radiogroup]]:flex [&>[role=radiogroup]]:w-full">
      <Segmented<FindMode>
        name="prasadam-find"
        label={PRASADAM.howToFind.en}
        value={value}
        onChange={onChange}
        options={[
          { value: "scan", en: PRASADAM.scanQr.en, kn: PRASADAM.scanQr.kn },
          { value: "type", en: PRASADAM.typeNumber.en, kn: PRASADAM.typeNumber.kn },
        ]}
      />
    </div>
  );
}

export default ScanTypeSwitch;
