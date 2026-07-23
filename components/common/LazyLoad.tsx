"use client";

import { useEffect, useRef, useState, ReactNode } from "react";

interface LazyLoadProps {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  threshold?: number;
  className?: string;
}

export function LazyLoad({
  children,
  fallback = null,
  rootMargin = "100px",
  threshold = 0,
  className = "",
}: LazyLoadProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return (
    <div ref={ref} className={className}>
      {isVisible ? children : fallback}
    </div>
  );
}

/**
 * Lazy load wrapper for dynamic imports
 */
export function LazyComponent({
  loader,
  fallback,
}: {
  loader: () => Promise<any>;
  fallback?: ReactNode;
}) {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    loader().then((module: { default: React.ComponentType<any> }) => {
      setComponent(() => module.default);
    });
  }, [loader]);

  if (!Component) return <>{fallback}</>;

  return <Component />;
}
