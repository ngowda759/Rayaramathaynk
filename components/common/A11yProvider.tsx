"use client";

import { useEffect, useState, ReactNode, createContext, useContext } from "react";
import { useHighContrast, useKeyboardNavigationMode } from "@/hooks/a11y";

interface A11yContextType {
  highContrast: boolean;
  reducedMotion: boolean;
  isKeyboardUser: boolean;
  announcements: string[];
  announce: (message: string, priority?: "polite" | "assertive") => void;
}

const A11yContext = createContext<A11yContextType | undefined>(undefined);

export function A11yProvider({ children }: { children: ReactNode }) {
  const highContrast = useHighContrast();
  const [reducedMotion, setReducedMotion] = useState(false);
  const isKeyboardUser = useKeyboardNavigationMode();
  const [announcements, setAnnouncements] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Media query initialization
    setReducedMotion(motionQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
       
      setReducedMotion(e.matches);
    };

    motionQuery.addEventListener("change", handleChange);
    return () => motionQuery.removeEventListener("change", handleChange);
  }, []);

  const announce = (message: string, priority: "polite" | "assertive" = "polite") => {
    setAnnouncements((prev) => [...prev, JSON.stringify({ message, priority })]);
  };

  return (
    <A11yContext.Provider
      value={{
        highContrast,
        reducedMotion,
        isKeyboardUser,
        announcements,
        announce,
      }}
    >
      {children}
      {/* Live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcements.map((ann, i) => (
          <span key={i}>{ann}</span>
        ))}
      </div>
    </A11yContext.Provider>
  );
}

export function useA11y() {
  const context = useContext(A11yContext);
  if (!context) {
    throw new Error("useA11y must be used within A11yProvider");
  }
  return context;
}

/**
 * Skip link component for keyboard navigation
 */
export function SkipLink({ targetId = "main-content" }: { targetId?: string }) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-amber-600 focus:px-4 focus:py-2 focus:text-white focus:font-semibold focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
    >
      Skip to main content
    </a>
  );
}

/**
 * Visually hidden component for screen readers
 */
export function VisuallyHidden({ 
  children, 
  className = "" 
}: { 
  children: ReactNode; 
  className?: string;
}) {
  return (
    <span className={`sr-only ${className}`}>
      {children}
    </span>
  );
}

/**
 * Focus trap wrapper for modals
 */
export function FocusTrap({ 
  children, 
  isActive 
}: { 
  children: ReactNode; 
  isActive: boolean;
}) {
  const containerRef = (children as any)?.props?.ref;

  useEffect(() => {
    if (!isActive || !containerRef?.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, containerRef]);

  return <>{children}</>;
}

/**
 * Live region for dynamic announcements
 */
export function LiveRegion() {
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"polite" | "assertive">("polite");

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setMessage(e.detail.message || "");
      setPriority(e.detail.priority || "polite");
    };

    window.addEventListener("a11y-announce" as any, handler);
    return () => window.removeEventListener("a11y-announce" as any, handler);
  }, []);

  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

/**
 * High contrast mode indicator
 */
export function HighContrastIndicator() {
  const { highContrast } = useA11y();

  if (!highContrast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-full bg-black px-4 py-2 text-sm font-medium text-white shadow-lg">
      High Contrast Mode
    </div>
  );
}

/**
 * Keyboard shortcut help
 */
export function KeyboardShortcutsHelp({ 
  shortcuts 
}: { 
  shortcuts: Array<{ keys: string[]; label: string }> 
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-xl">
      <h3 className="mb-4 text-lg font-semibold text-stone-900">
        Keyboard Shortcuts
      </h3>
      <dl className="space-y-2">
        {shortcuts.map((shortcut, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <dt className="text-stone-600">{shortcut.label}</dt>
            <dd className="flex gap-1">
              {shortcut.keys.map((key, j) => (
                <kbd
                  key={j}
                  className="rounded border border-stone-300 bg-stone-100 px-2 py-1 text-sm font-medium text-stone-700 shadow-sm"
                >
                  {key}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
