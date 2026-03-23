"use client";

// RollingNumber.tsx — Odometer-style animated number counter.
//
// When the `value` prop changes, the number rolls up (or down) smoothly
// using Framer Motion spring physics — like a slot machine or odometer.
//
// Strategy:
//   useMotionValue  →  driven by Framer's `animate()` with an expo-ease curve
//   useSpring       →  follows the motion value with slight elastic overshoot
//   ref DOM update  →  writes formatted text directly to DOM, zero re-renders

import { useEffect, useRef } from "react";
import { useMotionValue, useSpring, animate } from "framer-motion";

interface RollingNumberProps {
  /** Raw value in cents (e.g. 1500 = $15) */
  value: number;
  className?: string;
}

export default function RollingNumber({ value, className }: RollingNumberProps) {
  const motionValue = useMotionValue(value);

  // Spring wraps the motion value for elastic overshoot feel
  const springValue = useSpring(motionValue, {
    stiffness: 90,
    damping: 14,
    mass: 0.6,
  });

  const displayRef = useRef<HTMLSpanElement>(null);
  const isFirstRender = useRef(true);

  // Drive the motion value to the new target with expo-ease
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Snap to initial value instantly — no animation on mount
      motionValue.set(value);
      return;
    }
    // Animate to new value: fast acceleration, slow decelerate (slot machine feel)
    animate(motionValue, value, {
      duration: 1.4,
      ease: [0.12, 1, 0.28, 1], // custom expo-out easing
    });
  }, [value, motionValue]);

  // Subscribe to spring value changes — update DOM text directly
  useEffect(() => {
    const unsub = springValue.on("change", (v) => {
      if (displayRef.current) {
        const dollars = Math.round(Math.max(0, v) / 100);
        displayRef.current.textContent = `$${dollars.toLocaleString("en-US")}`;
      }
    });
    return unsub;
  }, [springValue]);

  // SSR / initial render: show correct value before any animation
  const initialDollars = Math.round(value / 100);

  return (
    <span ref={displayRef} className={className}>
      ${initialDollars.toLocaleString("en-US")}
    </span>
  );
}
