/**
 * Motion presets untuk framer-motion. Konsisten timing/easing dengan
 * design tokens. Respect prefers-reduced-motion lewat MotionConfig di
 * main.tsx (auto-disable animasi non-essential).
 */

import type { Transition, Variants } from 'framer-motion'

export const transition: Transition = {
  duration: 0.2,
  ease: [0.2, 0, 0, 1],
}

export const transitionFast: Transition = {
  duration: 0.12,
  ease: [0.2, 0, 0, 1],
}

export const transitionSlow: Transition = {
  duration: 0.3,
  ease: [0.2, 0, 0, 1],
}

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition },
  exit: { opacity: 0, transition: transitionFast },
}

export const slideUp: Variants = {
  initial: { y: '100%' },
  animate: { y: 0, transition },
  exit: { y: '100%', transition },
}

export const slideUpFade: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition },
  exit: { opacity: 0, y: 16, transition: transitionFast },
}

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition },
  exit: { opacity: 0, scale: 0.96, transition: transitionFast },
}

export const pressScale = {
  whileTap: { scale: 0.97 },
  transition: transitionFast,
}
