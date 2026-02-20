import type { Variants } from 'motion/react';

// Page enter/exit
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export const pageTransition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1] as const,
};

// List stagger
export const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.04 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

// Card hover
export const cardHover = {
  scale: 1.015,
  transition: { duration: 0.15, ease: 'easeOut' as const },
};

// Fade in
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
};

// Slide from right (for Sheet / panels)
export const slideFromRight: Variants = {
  initial: { x: '100%' },
  animate: { x: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { x: '100%', transition: { duration: 0.2 } },
};
