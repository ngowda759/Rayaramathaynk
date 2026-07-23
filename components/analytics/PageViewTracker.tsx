"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/services/pageviews.service";

export function PageViewTracker() {
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

function detectDeviceType(): "mobile" | "desktop" | "tablet" {
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
  return navigator.language.split("-")[0] || "en";
}
