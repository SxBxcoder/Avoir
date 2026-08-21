export const springConfig = { type: 'spring' as const, stiffness: 300, damping: 30 };
export const bouncySpring = { type: 'spring' as const, stiffness: 400, damping: 20 };
export const gentleSpring = { type: 'spring' as const, stiffness: 200, damping: 25 };
export const smoothSpring = { type: 'spring' as const, stiffness: 100, damping: 30 };

export const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
export const staggerItem = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: springConfig },
};
