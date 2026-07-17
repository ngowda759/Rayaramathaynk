"use client";

import { motion, Variants } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import React from "react";

type AnimationDirection =
  | "fade"
  | "fade-up"
  | "fade-down"
  | "fade-left"
  | "fade-right"
  | "scale"
  | "zoom";

interface AnimateInProps {
  children: React.ReactNode;
  direction?: AnimationDirection;
  duration?: number;
  delay?: number;
  className?: string;
  once?: boolean;
  amount?: "some" | "all" | number;
  as?: keyof React.JSX.IntrinsicElements;
}

const directionVariants: Record<AnimationDirection, Variants> = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  "fade-up": {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
  },
  "fade-down": {
    hidden: { opacity: 0, y: -30 },
    visible: { opacity: 1, y: 0 },
  },
  "fade-left": {
    hidden: { opacity: 0, x: -40 },
    visible: { opacity: 1, x: 0 },
  },
  "fade-right": {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
  },
  zoom: {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
  },
};

export function AnimateIn({
  children,
  direction = "fade-up",
  duration = 0.5,
  delay = 0,
  className,
  once = true,
  amount = 0.3,
}: AnimateInProps) {
  const reducedMotion = useReducedMotion();
  
  // Instant animation for reduced motion
  const actualDuration = reducedMotion ? 0.01 : duration;
  const actualDelay = reducedMotion ? 0 : delay;

  const variants = directionVariants[direction];

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      transition={{
        duration: actualDuration,
        delay: actualDelay,
        ease: [0.25, 0.1, 0.25, 1] as const,
      }}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Staggered children wrapper
interface StaggerInProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  initialDelay?: number;
  once?: boolean;
}

export function StaggerIn({
  children,
  className,
  staggerDelay = 0.1,
  initialDelay = 0,
  once = true,
}: StaggerInProps) {
  const reducedMotion = useReducedMotion();
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: reducedMotion ? 0.01 : staggerDelay,
        delayChildren: reducedMotion ? 0 : initialDelay,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.2 }}
      variants={containerVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Individual stagger item
interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
  direction?: AnimationDirection;
}

export function StaggerItem({
  children,
  className,
  direction = "fade-up",
}: StaggerItemProps) {
  const reducedMotion = useReducedMotion();
  const variants = directionVariants[direction];

  return (
    <motion.div
      variants={variants}
      transition={{
        duration: reducedMotion ? 0.01 : 0.4,
        ease: [0.25, 0.1, 0.25, 1] as const,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
