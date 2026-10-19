"use client";

import type { JSX } from "react";

import { ExportForm } from "@/components/seva/export/ExportForm";
import { SevaGate } from "@/components/seva/shell/SevaGate";

/**
 * Export (DB §12.6; mockup dashboard.html#export): Excel, CSV, Tally import and the board print summary for a range.
 * Temple admins (view-only included) and super admins; phone numbers only for those with `export.with_phones`.
 */
export default function ExportPage(): JSX.Element {
  return (
    <SevaGate action="export.basic">
      <ExportForm />
    </SevaGate>
  );
}
