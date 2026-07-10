"use client";

import { useState } from "react";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import HomepageSettings from "@/components/admin/settings/HomepageSettings";

export default function HomepageSettingsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Homepage Settings"
        description="Manage the content displayed on the public homepage."
      />

      <HomepageSettings
        key={refreshKey}
        onSaved={() => setRefreshKey((prev) => prev + 1)}
      />
    </div>
  );
}
