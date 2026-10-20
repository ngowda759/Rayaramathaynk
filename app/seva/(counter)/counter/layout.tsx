import type { ReactNode } from "react";
import RegisterServiceWorker from "@/components/seva/counter/RegisterServiceWorker";

/**
 * The counter pages register the Seva Entry service worker (offline counter, Design Book 6.3, 9.11). The install
 * manifest is linked once, by the module layout (`app/seva/layout.tsx`), so every role installs the same app.
 */
interface CounterLayoutProps {
  children: ReactNode;
}

export default function CounterLayout({ children }: CounterLayoutProps) {
  return (
    <>
      {children}
      <RegisterServiceWorker />
    </>
  );
}
