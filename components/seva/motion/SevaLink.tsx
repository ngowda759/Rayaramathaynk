"use client";

import { useLayoutEffect, useSyncExternalStore, type ComponentProps, type JSX } from "react";
import Link, { useLinkStatus } from "next/link";

import { hrefPath, navProgress, type NavPendingState } from "@/lib/seva/motion";

type LinkProps = ComponentProps<typeof Link>;

function hrefText(href: LinkProps["href"]): string {
  if (typeof href === "string") return href;
  const path = href.pathname ?? "";
  const query = typeof href.search === "string" ? href.search : "";
  return `${path}${query}`;
}

/** Reports this link's pending navigation (Next's useLinkStatus) to the shared store while it lasts. */
function LinkStatusReporter({ href }: { href: string }): null {
  const { pending } = useLinkStatus();
  useLayoutEffect(() => {
    if (!pending) return undefined;
    const id = navProgress.begin(href);
    return () => navProgress.end(id);
  }, [pending, href]);
  return null;
}

/**
 * next/link for seva pages: a client-side navigation (no full reload) whose pending state lights the top progress bar
 * and the receipts template's page outline at once. Takes every next/link prop.
 */
export function SevaLink({ children, href, ...props }: LinkProps): JSX.Element {
  return (
    <Link href={href} {...props}>
      {children}
      <LinkStatusReporter href={hrefText(href)} />
    </Link>
  );
}

/** Whether a seva navigation is pending, and where to. */
export function useNavPending(): NavPendingState {
  return useSyncExternalStore(navProgress.subscribe, navProgress.snapshot, navProgress.serverSnapshot);
}

/** The same feedback as SevaLink for code that navigates with `router.push`. */
export function navigateWithProgress(router: { push(href: string): void }, href: string): void {
  if (typeof window !== "undefined" && hrefPath(href) !== window.location.pathname) {
    navProgress.begin(href, { manual: true });
  }
  router.push(href);
}

export default SevaLink;
