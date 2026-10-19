import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SevaModuleShell } from "@/components/seva/shell/SevaModuleShell";
import "@/styles/seva/tokens.css";
import "@/styles/seva/print.css";

/**
 * Seva Entry installs as one app for every role (owner, 2026-10-20) from any /seva page, in Edge or Chrome (Design
 * Book 6.3). The manifest keeps `id` `/seva/counter`, so a counter PC that installed it earlier keeps the same app.
 */
export const metadata: Metadata = {
  manifest: "/seva-counter.webmanifest",
};

interface SevaLayoutProps {
  children: ReactNode;
}

/**
 * Seva Entry at `/seva` (plan A4S-1). A server layout, so it can link the install manifest; the guard, the module
 * look and the print root live in the client `SevaModuleShell`.
 * The frames come from the two route groups (plan A4S-2): `(desk)` draws the header, section rail and phone bar,
 * `(counter)` the full-screen counter; each holds the page's `main#main-content`, the skip link's target.
 */
export default function SevaLayout({ children }: SevaLayoutProps) {
  return <SevaModuleShell>{children}</SevaModuleShell>;
}
