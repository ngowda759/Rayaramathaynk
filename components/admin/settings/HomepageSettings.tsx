"use client";

import HomepageForm from "./homepage/HomepageForm";
import { HomepageSettingsProps } from "./homepage/types";

export default function HomepageSettings({
  onSaved,
}: HomepageSettingsProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-2">
          <h2 className="text-xl font-semibold text-stone-900">
            Homepage Settings
          </h2>

          <p className="mt-1 text-sm text-stone-600">
            Configure the content displayed on the public homepage.
          </p>
        </div>
      </div>

      <HomepageForm onSaved={onSaved} />
    </div>
  );
}
