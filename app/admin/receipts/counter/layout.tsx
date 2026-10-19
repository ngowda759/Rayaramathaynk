import type { Metadata } from "next";
import type { ReactNode } from "react";
import RegisterServiceWorker from "@/components/seva/counter/RegisterServiceWorker";

/** The counter installs as its own window ("Seva Counter") from Edge or Chrome (Design Book 6.3). */
export const metadata: Metadata = {
  manifest: "/seva-counter.webmanifest",
};

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
