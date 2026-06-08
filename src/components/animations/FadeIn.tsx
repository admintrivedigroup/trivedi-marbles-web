"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

type FadeInDirection = "up" | "down" | "left" | "right" | "scale" | "none";

type FadeInProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
  direction?: FadeInDirection;
  duration?: number;
};

const initialVariants: Record<FadeInDirection, object> = {
  up:    { opacity: 0, y: 30 },
  down:  { opacity: 0, y: -30 },
  left:  { opacity: 0, x: -48 },
  right: { opacity: 0, x: 48 },
  scale: { opacity: 0, scale: 0.93 },
  none:  { opacity: 0 },
};

const animateVariants: Record<FadeInDirection, object> = {
  up:    { opacity: 1, y: 0 },
  down:  { opacity: 1, y: 0 },
  left:  { opacity: 1, x: 0 },
  right: { opacity: 1, x: 0 },
  scale: { opacity: 1, scale: 1 },
  none:  { opacity: 1 },
};

export function FadeIn({
  children,
  className,
  delay = 0,
  direction = "up",
  duration = 0.8,
}: FadeInProps) {
  return (
    <motion.div
      initial={initialVariants[direction]}
      whileInView={animateVariants[direction]}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
