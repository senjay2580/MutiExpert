import { motion, AnimatePresence } from 'motion/react';
import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/*  AnimatedList — staggered entrance for list/grid children           */
/* ------------------------------------------------------------------ */

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedList({ children, className }: AnimatedListProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06 } },
      }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  AnimatedItem — individual item with slide-up + fade entrance       */
/* ------------------------------------------------------------------ */

interface AnimatedItemProps {
  children: ReactNode;
  className?: string;
  layout?: boolean;
}

export function AnimatedItem({ children, className, layout }: AnimatedItemProps) {
  return (
    <motion.div
      className={className}
      layout={layout}
      variants={{
        hidden: { opacity: 0, y: 16, scale: 0.97 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { type: 'spring', stiffness: 400, damping: 28 },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  AnimatedPresence — for enter/exit of conditional elements          */
/* ------------------------------------------------------------------ */

interface AnimatedPresenceItemProps {
  children: ReactNode;
  className?: string;
  /** Unique key for AnimatePresence tracking */
  itemKey: string;
}

export function AnimatedPresenceItem({ children, className, itemKey }: AnimatedPresenceItemProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={itemKey}
        className={className}
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export { AnimatePresence };
