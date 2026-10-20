import type { JSX } from "react";

import { PageSkeleton } from "@/components/seva/motion/PageSkeleton";
import { skeletonFor } from "@/lib/seva/motion";
import { SEVA_ROUTES } from "@/lib/seva/routes";

/** Shown at once while this seva screen loads: its outline, shaped like the screen (plan A4P-1). */
export default function Loading(): JSX.Element {
  return <PageSkeleton variant={skeletonFor(SEVA_ROUTES.settingsRules)} />;
}
