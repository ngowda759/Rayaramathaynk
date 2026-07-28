"use client";

import { useInView, Variants } from "framer-motion";
import { useRef, useEffect, useState } from "react";

interface UseInViewAnimationOptions {
  once?: boolean;
  margin?: string | number;
  amount?: "some" | "all" | number;
  freeze?: boolean;
}

/**
 * Hook for viewport-triggered animations
 * Automatically triggers when element enters viewport
 */
export function useInViewAnimation<T extends HTMLElement>(
  options: UseInViewAnimationOptions = {}
) {
  const { once = true, margin = "-50px", amount = 0.3, freeze = false } = options;
  const ref = useRef<T>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  const isInView = useInView(ref, {
    once,
    margin: margin as "-50px",
    amount,
  });

  useEffect(() => {
    if (isInView && !hasAnimated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Animation trigger pattern
      setHasAnimated(true);
    }
  }, [isInView, hasAnimated]);

  return {
    ref,
    isInView: hasAnimated || (isInView && !freeze),
    hasAnimated: hasAnimated,
  };
}

/**
 * Hook to track scroll progress within an element
 * Returns a value between 0 and 1
 */
export function useScrollProgress(ref: React.RefObject<HTMLElement>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleScroll = () => {
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const elementHeight = rect.height;

      // Calculate how far through the element we've scrolled
      const scrolled = windowHeight - rect.top;
      const total = windowHeight + elementHeight;
      const percentage = Math.max(0, Math.min(1, scrolled / total));

      setProgress(percentage);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [ref]);

  return progress;
}

/**
 * Hook for parallax effects
 */
export function useParallax(
  speed: number = 0.5,
  direction: "up" | "down" = "up"
) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const offsetValue = direction === "up" 
        ? scrollY * speed 
        : -scrollY * speed;
      setOffset(offsetValue);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [speed, direction]);

  return offset;
}
