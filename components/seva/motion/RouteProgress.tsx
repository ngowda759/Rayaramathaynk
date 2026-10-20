"use client";

import { useEffect, useState, type JSX, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { m, type TargetAndTransition } from "framer-motion";

import { SPRING, hrefPath, navProgress, skeletonFor } from "@/lib/seva/motion";
import { SHELL } from "@/lib/seva/strings/shell";

import { PageSkeleton } from "./PageSkeleton";
import { useNavPending } from "./SevaLink";

type Phase = "idle" | "running" | "finishing";

const PHASES: Record<Phase, TargetAndTransition> = {
  // Shows at once at a sliver, then creeps on slowly while the page loads.
  running: {
    scaleX: [0.12, 0.88],
    opacity: 1,
    transition: { scaleX: { duration: 8, ease: [0.1, 0.75, 0.25, 1] }, opacity: { duration: 0 } },
  },
  // Springs to the end, then fades away.
  finishing: {
    scaleX: 1,
    opacity: 0,
    transition: { scaleX: SPRING, opacity: { delay: 0.18, duration: 0.2 } },
  },
  idle: { scaleX: 0, opacity: 0, transition: { duration: 0 } },
};

/**
 * The 3 px progress bar fixed at the top of a seva page (plan A4P-1). It appears within a frame of a pending seva link
 * (SevaLink) or `navigateWithProgress`, and finishes with a spring when the new page is in.
 */
export function RouteProgress(): JSX.Element {
  const { pending } = useNavPending();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");

  // Follow the store during render (no effect delay): pending starts the bar; its end finishes it.
  if (pending && phase !== "running") setPhase("running");
  if (!pending && phase === "running") setPhase("finishing");

  // A router.push navigation is over once the path changes (and on arrival from another part of the admin).
  useEffect(() => {
    navProgress.settleManual();
  }, [pathname]);

  return (
    <m.div
      data-route-progress=""
      data-state={phase}
      role={phase === "running" ? "progressbar" : undefined}
      aria-label={phase === "running" ? SHELL.loading.en : undefined}
      aria-hidden={phase === "running" ? undefined : true}
      className="pointer-events-none fixed inset-x-0 top-0 z-[90] h-[3px] origin-left bg-(--primary) shadow-[0_0_8px_var(--primary)]"
      initial={false}
      animate={PHASES[phase]}
      onAnimationComplete={() => {
        if (phase === "finishing") setPhase("idle");
      }}
    />
  );
}

/**
 * While a seva navigation to another page is pending, shows that page's outline (PageSkeleton) in place of the current
 * page at once, so a click is never met with a frozen screen. The current page stays mounted underneath, hidden.
 */
export function RoutePending({ children }: { children: ReactNode }): JSX.Element {
  const { pending, href } = useNavPending();
  const pathname = usePathname();
  const leaving = pending && href !== null && hrefPath(href) !== pathname;
  return (
    <>
      {leaving && href ? <PageSkeleton variant={skeletonFor(href)} /> : null}
      <div aria-hidden={leaving || undefined} className={leaving ? "hidden" : "contents"}>
        {children}
      </div>
    </>
  );
}

export default RouteProgress;
