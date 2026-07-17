import { Variants, Transition } from "framer-motion";

// Animation duration constants for consistency
export const ANIMATION_DURATION = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  slower: 0.7,
  slowest: 1.0,
} as const;

// Easing presets for smooth animations
export const EASING = {
  smooth: [0.25, 0.1, 0.25, 1] as const,
  bounce: [0.68, -0.55, 0.265, 1.55] as const,
  spring: { type: "spring", stiffness: 300, damping: 30 } as const,
  gentle: { type: "spring", stiffness: 100, damping: 20 } as const,
  snappy: { type: "spring", stiffness: 500, damping: 50 } as const,
} as const;

// Base animation variants
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const fadeOut: Variants = {
  visible: { opacity: 1 },
  hidden: { opacity: 0 },
};

// Fade up variant - great for text and content blocks
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: ANIMATION_DURATION.slow,
      ease: EASING.smooth,
    },
  },
};

// Fade down variant
export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: ANIMATION_DURATION.slow,
      ease: EASING.smooth,
    },
  },
};

// Fade left variant - great for elements coming from left
export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: ANIMATION_DURATION.slow,
      ease: EASING.smooth,
    },
  },
};

// Fade right variant
export const fadeRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: ANIMATION_DURATION.slow,
      ease: EASING.smooth,
    },
  },
};

// Scale up variant - great for cards and modals
export const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: ANIMATION_DURATION.normal,
      ease: EASING.smooth,
    },
  },
};

// Scale down variant
export const scaleDown: Variants = {
  hidden: { opacity: 0, scale: 1.1 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: ANIMATION_DURATION.normal,
      ease: EASING.smooth,
    },
  },
};

// Zoom in variant
export const zoomIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: ANIMATION_DURATION.slower,
      ease: EASING.smooth,
    },
  },
};

// Slide up variant - more dramatic than fade
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: ANIMATION_DURATION.slower,
      ease: EASING.smooth,
    },
  },
};

// Page transition variants
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 20 },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: ANIMATION_DURATION.slow,
      ease: EASING.smooth,
      when: "beforeChildren",
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: ANIMATION_DURATION.normal,
      ease: EASING.smooth,
    },
  },
};

// Modal/Dialog transition
export const modalTransition: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: ANIMATION_DURATION.normal,
      ease: EASING.smooth,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: {
      duration: ANIMATION_DURATION.fast,
      ease: EASING.smooth,
    },
  },
};

// Overlay transition
export const overlayTransition: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// Stagger container variants
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

// Stagger container with custom delay
export const staggerContainerWithDelay = (delay: number = 0.1): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: delay,
    },
  },
});

// Hover scale effect
export const hoverScale = {
  scale: 1.02,
  transition: { duration: ANIMATION_DURATION.fast, ease: EASING.smooth },
};

// Hover lift effect (for cards)
export const hoverLift = {
  y: -4,
  boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
  transition: { duration: ANIMATION_DURATION.fast, ease: EASING.smooth },
};

// Button press effect
export const buttonTap = {
  scale: 0.97,
  transition: { duration: ANIMATION_DURATION.fast },
};

// Ambient floating animation
export const floatingAnimation = {
  y: [-8, 8, -8],
  transition: {
    duration: 4,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

// Pulse glow animation
export const pulseGlowAnimation = {
  opacity: [0.5, 1, 0.5],
  scale: [1, 1.05, 1],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

// Rotate animation
export const rotateAnimation = {
  rotate: [0, 360],
  transition: {
    duration: 20,
    repeat: Infinity,
    ease: "linear",
  },
};

// Subtle shimmer for loading states
export const shimmerAnimation = {
  backgroundPosition: ["200% 0", "-200% 0"],
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: "linear",
  },
};

// Create staggered children variants
export const createStaggerChildren = (
  baseVariant: Variants,
  staggerDelay: number = 0.1
): Variants => {
  return {
    hidden: baseVariant.hidden,
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.1,
      },
    },
  };
};
