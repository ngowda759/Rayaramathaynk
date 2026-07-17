"use client";

import { motion, AnimatePresence, Transition } from "framer-motion";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className = "" }: PageTransitionProps) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  // Instant transitions for reduced motion
  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ 
          opacity: 1, 
          y: 0,
          transition: {
            duration: 0.4,
            ease: [0.25, 0.1, 0.25, 1] as const,
          },
        }}
        exit={{ 
          opacity: 0, 
          y: -10,
          transition: {
            duration: 0.25,
            ease: [0.25, 0.1, 0.25, 1] as const,
          },
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Page loader component
interface PageLoaderProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
}

export function PageLoader({ isLoading, children, className = "" }: PageLoaderProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return isLoading ? null : <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center justify-center min-h-[50vh]"
        >
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-200 border-t-amber-600" />
            <div className="absolute inset-0 animate-ping rounded-full border-2 border-amber-400 opacity-20" />
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Section transition wrapper
interface SectionTransitionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
}

export function SectionTransition({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: SectionTransitionProps) {
  const reducedMotion = useReducedMotion();

  const getInitialPosition = () => {
    switch (direction) {
      case "up": return { y: 30, x: 0 };
      case "down": return { y: -30, x: 0 };
      case "left": return { y: 0, x: 40 };
      case "right": return { y: 0, x: -40 };
      default: return { y: 30, x: 0 };
    }
  };

  const initial = reducedMotion ? { opacity: 1 } : { opacity: 0, ...getInitialPosition() };
  const animate = reducedMotion 
    ? { opacity: 1 } 
    : { opacity: 1, ...getInitialPosition(), y: 0, x: 0 };

  return (
    <motion.div
      initial={initial}
      whileInView={animate}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: reducedMotion ? 0.01 : 0.5,
        delay: reducedMotion ? 0 : delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
