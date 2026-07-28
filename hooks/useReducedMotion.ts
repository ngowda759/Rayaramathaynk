"use client";

import { useEffect, useState } from "react";

/**
 * Hook to detect if user prefers reduced motion
 * Respects system accessibility settings
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Check if window is defined (client-side only)
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    
    // Set initial value
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Media query initialization
    setReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return reducedMotion;
}

/**
 * Hook to get animation configuration based on reduced motion preference
 * Returns reduced values when prefers-reduced-motion is enabled
 */
export function useMotionConfig() {
  const reducedMotion = useReducedMotion();

  return {
    reducedMotion,
    shouldAnimate: !reducedMotion,
    duration: reducedMotion ? 0.01 : 0.3,
    staggerDelay: reducedMotion ? 0.01 : 0.1,
    // Return instant animations for reduced motion
    instant: reducedMotion,
  };
}
