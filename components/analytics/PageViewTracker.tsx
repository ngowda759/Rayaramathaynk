"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/services/pageviews.service";

function PageViewTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Track page view when pathname or search params change
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    
    // Get referrer
    const referrer = document.referrer || undefined;
    
    // Track the page view
    trackPageView({
      path: url,
      referrer,
      deviceType: detectDeviceType(),
      language: detectLanguage(),
    });
  }, [pathname, searchParams]);

  return null;
}

export function PageViewTracker() {
  return (
    <Suspense fallback={null}>
      <PageViewTrackerInner />
    </Suspense>
  );
}

function detectDeviceType(): "mobile" | "desktop" | "tablet" {
  if (typeof window === "undefined") return "desktop";
  
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet";
  }
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

function detectLanguage(): string {
  if (typeof navigator === "undefined") return "en";
  return navigator.language.split("-")[0] || "en";
}
