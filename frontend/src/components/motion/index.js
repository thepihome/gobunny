import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const easeOut = [0.22, 1, 0.36, 1];

export const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: easeOut },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: easeOut },
  },
};

export const fadeUpVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.38, delay: i * 0.05, ease: easeOut },
  }),
};

export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.08 },
  },
};

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: easeOut },
  },
};

export function PageTransition({ children }) {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className="page-transition">{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        className="page-transition"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function FadeIn({ children, className, delay = 0, as = 'div' }) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as] || motion.div;

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <Component
      className={className}
      custom={delay}
      variants={fadeUpVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </Component>
  );
}

export function StaggerGrid({ children, className }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={className} variants={staggerItemVariants}>
      {children}
    </motion.div>
  );
}

export function AnimatedPanel({ children, className, hover = true }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20, scale: 0.975 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.42, ease: easeOut }}
      whileHover={
        hover
          ? {
              y: -4,
              transition: { duration: 0.22, ease: easeOut },
            }
          : undefined
      }
    >
      {children}
    </motion.div>
  );
}

export function MotionSidebarItem({ children, className, isActive, delay = 0 }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.32, delay, ease: easeOut }}
      data-active={isActive || undefined}
    >
      {children}
    </motion.div>
  );
}
