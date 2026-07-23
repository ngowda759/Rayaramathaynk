/**
 * Accessibility Hooks
 * Keyboard navigation, focus management, and accessibility utilities
 */

import { useEffect, useRef, useCallback, useState } from "react";

/**
 * Hook to detect high contrast mode preference
 */
export function useHighContrast(): boolean {
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-contrast: more)");
    
    setHighContrast(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setHighContrast(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return highContrast;
}

/**
 * Hook to get accessibility color class based on contrast mode
 */
export function useAccessibleColors() {
  const highContrast = useHighContrast();

  return {
    highContrast,
    textClass: highContrast ? "text-black dark:text-white" : "text-stone-900 dark:text-stone-100",
    bgClass: highContrast ? "bg-white dark:bg-black" : "bg-stone-50 dark:bg-stone-900",
    borderClass: highContrast ? "border-2 border-black dark:border-white" : "border border-stone-300",
    focusClass: highContrast 
      ? "outline-none ring-4 ring-black dark:ring-white" 
      : "outline-none ring-2 ring-amber-500 ring-offset-2",
  };
}

/**
 * Hook for focus trap in modals
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element when trap becomes active
    firstElement?.focus();

    function handleKeyDown(e: KeyboardEvent) {
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
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Hook for keyboard navigation in lists/grids
 */
export function useKeyboardNavigation(
  itemCount: number,
  onSelect: (index: number) => void,
  options?: {
    orientation?: "horizontal" | "vertical" | "both";
    loop?: boolean;
    wrap?: boolean;
  }
) {
  const { orientation = "vertical", loop = true, wrap = false } = options || {};
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let newIndex = focusedIndex;
      const isVertical = orientation === "vertical" || orientation === "both";
      const isHorizontal = orientation === "horizontal" || orientation === "both";

      switch (e.key) {
        case "ArrowDown":
          if (isVertical) {
            e.preventDefault();
            newIndex = focusedIndex + 1;
          }
          break;
        case "ArrowUp":
          if (isVertical) {
            e.preventDefault();
            newIndex = focusedIndex - 1;
          }
          break;
        case "ArrowRight":
          if (isHorizontal) {
            e.preventDefault();
            newIndex = focusedIndex + 1;
          }
          break;
        case "ArrowLeft":
          if (isHorizontal) {
            e.preventDefault();
            newIndex = focusedIndex - 1;
          }
          break;
        case "Home":
          e.preventDefault();
          newIndex = 0;
          break;
        case "End":
          e.preventDefault();
          newIndex = itemCount - 1;
          break;
        case "Enter":
        case " ":
          if (focusedIndex >= 0) {
            e.preventDefault();
            onSelect(focusedIndex);
          }
          break;
        default:
          return;
      }

      // Handle boundaries
      if (loop) {
        if (newIndex < 0) newIndex = itemCount - 1;
        if (newIndex >= itemCount) newIndex = 0;
      } else if (wrap) {
        if (newIndex < 0) newIndex = Math.max(0, newIndex);
        if (newIndex >= itemCount) newIndex = Math.min(itemCount - 1, newIndex);
      } else {
        if (newIndex < 0 || newIndex >= itemCount) return;
      }

      setFocusedIndex(newIndex);
    },
    [focusedIndex, itemCount, orientation, loop, wrap, onSelect]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    getItemProps: (index: number) => ({
      tabIndex: focusedIndex === index ? 0 : -1,
      onFocus: () => setFocusedIndex(index),
    }),
  };
}

/**
 * Hook for announce to screen readers
 */
export function useAnnounce() {
  const announce = useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
    const node = document.createElement("div");
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", priority);
    node.setAttribute("aria-atomic", "true");
    node.className = "sr-only";
    node.textContent = message;

    document.body.appendChild(node);

    setTimeout(() => {
      document.body.removeChild(node);
    }, 1000);
  }, []);

  return announce;
}

/**
 * Hook for skip link functionality
 */
export function useSkipLink(targetId: string = "main-content") {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: "smooth" });
    }
  }, [targetId]);

  return { targetId, handleClick };
}

/**
 * Hook to detect if user is navigating via keyboard
 */
export function useKeyboardNavigationMode(): boolean {
  const [isKeyboard, setIsKeyboard] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Tab") {
        setIsKeyboard(true);
      }
    }

    function handleMouseDown() {
      setIsKeyboard(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  return isKeyboard;
}

/**
 * Hook for managing roving tabindex
 */
export function useRovingTabIndex(items: any[], options?: { loop?: boolean }) {
  const { loop = true } = options || {};
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let newIndex = activeIndex;

      switch (e.key) {
        case "ArrowDown":
        case "ArrowRight":
          e.preventDefault();
          newIndex = activeIndex + 1;
          break;
        case "ArrowUp":
        case "ArrowLeft":
          e.preventDefault();
          newIndex = activeIndex - 1;
          break;
        case "Home":
          e.preventDefault();
          newIndex = 0;
          break;
        case "End":
          e.preventDefault();
          newIndex = items.length - 1;
          break;
        default:
          return;
      }

      if (loop) {
        if (newIndex < 0) newIndex = items.length - 1;
        if (newIndex >= items.length) newIndex = 0;
      } else {
        newIndex = Math.max(0, Math.min(items.length - 1, newIndex));
      }

      setActiveIndex(newIndex);
    },
    [activeIndex, items.length, loop]
  );

  return {
    activeIndex,
    setActiveIndex,
    handleKeyDown,
    getItemProps: (index: number) => ({
      tabIndex: activeIndex === index ? 0 : -1,
      onFocus: () => setActiveIndex(index),
    }),
  };
}
